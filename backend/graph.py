from langchain_ollama import ChatOllama
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from typing import TypedDict, Annotated, List
from langchain_core.messages import AnyMessage
import operator
import os
from langchain_core.messages import ToolMessage
from mcp_client import mcp_client
from rag import retrieve_context
from tools import current_customer_id
from obs_logger import obs_log

# 1. Define State
class AgentState(TypedDict):
    messages: Annotated[List[AnyMessage], operator.add]
    customer_id: int
    step_count: int
    pending_action: dict | None

# 2. Initialize LLM & Tools
llm = ChatOllama(model="qwen2.5:7b", temperature=0.1)
tools = mcp_client.get_tools() + [retrieve_context]
llm_with_tools = llm.bind_tools(tools)

SYSTEM_PROMPT = """You are a helpful Telecom Customer Support AI. 
You are currently talking to a logged-in user (Customer ID: {customer_id}).
You can answer questions using the provided context, or use tools to check account details.
IMPORTANT: The tools automatically know the user's customer_id behind the scenes. Just call the tools directly without providing any customer ID!
If a user asks for their package, you MUST call the `get_customer_package` tool. If a user asks for their data balance, you MUST call the `get_data_balance` tool. Call only the tool(s) relevant to what was asked. Do not use the knowledge base (retrieve_context) for personal account queries.
If a user wants to change their package, you MUST use the change_customer_package tool.
If a user wants to open, create, or issue a support ticket, you MUST use the create_support_ticket tool, passing their issue_description. Never pretend to create a ticket without using the tool!
If the tool returns 'CONFIRMATION_REQUIRED', you must ask the user to confirm before calling it again with confirmed=True.
If a user request requires a tool but is missing required parameters (like issue_description), politely ask them for the missing information before calling the tool. Do not call the tool with an empty description.
If a user asks about company policies, rules, roaming, refunds, or general telecom information, you MUST use the `retrieve_context` tool to search the knowledge base. NEVER guess or make up policies, document names, or source names. Only state information and sources that are explicitly returned by the `retrieve_context` tool.
When providing information from the knowledge base, you MUST explicitly state the metadata source name (which is provided to you in brackets like [Source: <name>]) naturally in your response, for example: "According to the <name> document...". Do not just append the brackets at the end.
Always be polite and concise."""

# 3. Define Nodes
async def agent_node(state: AgentState):
    step_count = state.get("step_count", 0) + 1
    obs_log("agent_node", "ENTER", {"step_count": step_count, "pending_action": state.get("pending_action")})

    if step_count > 6:
        obs_log("agent_node", "LOOP_CAP", {"step_count": step_count, "action": "returning fallback message"})
        return {"messages": [AIMessage(content="I seem to be having trouble processing your request. Please consider opening a support ticket for further assistance.")], "step_count": step_count}
        
    dynamic_prompt = SYSTEM_PROMPT.format(customer_id=state.get("customer_id", "Unknown"))
    messages = [SystemMessage(content=dynamic_prompt)] + state["messages"]
    response = await llm_with_tools.ainvoke(messages)

    tool_calls = getattr(response, "tool_calls", [])
    obs_log("agent_node", "LLM_RESPONSE", {
        "has_tool_calls": bool(tool_calls),
        "tool_names": [tc["name"] for tc in tool_calls],
        "content_preview": (response.content or "")[:120],
    })
    return {"messages": [response], "step_count": step_count}

async def tool_node(state: AgentState):
    last_message = state["messages"][-1]
    tool_map = {t.name: t for t in tools}
    results = []
    
    pending_action = state.get("pending_action")
    new_pending_action = pending_action
    
    for tool_call in last_message.tool_calls:
        tool = tool_map[tool_call["name"]]
        args = tool_call["args"]

        obs_log("tool_node", "TOOL_CALL", {"tool": tool.name, "args": args})
        
        # Inject customer_id unconditionally before every tool call
        current_customer_id.set(state.get("customer_id", 0))
        
        # Enforce confirmation state machine for package change
        if tool.name == "change_customer_package":
            if args.get("confirmed") is True:
                if not pending_action or pending_action.get("tool") != "change_customer_package" or pending_action.get("new_package") != args.get("new_package"):
                    # Mismatch or no pending action, force confirmed=False to trigger re-confirmation
                    args["confirmed"] = False
                    obs_log("tool_node", "CONFIRM_GUARD", {
                        "reason": "confirmed=True received but no matching pending_action found — resetting to False",
                        "pending_action": pending_action,
                        "requested_package": args.get("new_package"),
                    })
            
        try:
            observation = await tool.ainvoke(args)
        except Exception as e:
            observation = f"Error executing tool: {str(e)}"
            obs_log("tool_node", "TOOL_ERROR", {"tool": tool.name, "error": str(e)})

        obs_log("tool_node", "TOOL_RESULT", {"tool": tool.name, "result": str(observation)[:200]})
            
        if tool.name == "change_customer_package":
            obs_str = str(observation)
            if obs_str.startswith("CONFIRMATION_REQUIRED"):
                new_pending_action = {"tool": "change_customer_package", "new_package": args.get("new_package")}
            elif "Invalid package" not in obs_str:
                # Executed successfully or failed in another way, clear pending
                new_pending_action = None
            obs_log("tool_node", "CONFIRM_STATE", {
                "before": pending_action,
                "after": new_pending_action,
            })
                
        results.append(ToolMessage(content=str(observation), tool_call_id=tool_call["id"]))
        
    return {"messages": results, "pending_action": new_pending_action}


# 4. Define Routing Logic
def route_agent(state: AgentState):
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        obs_log("router", "ROUTE", {"next": "tools", "tools": [tc["name"] for tc in last_message.tool_calls]})
        return "tools"
    obs_log("router", "ROUTE", {"next": "end"})
    return "end"

# 5. Build Graph
workflow = StateGraph(AgentState)
workflow.add_node("agent", agent_node)
workflow.add_node("tools", tool_node)

workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", route_agent, {"tools": "tools", "end": END})
workflow.add_edge("tools", "agent") # Loop back to agent to process tool results

graph = workflow.compile()