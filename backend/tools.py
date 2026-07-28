import random
import os
from langchain_core.tools import tool
from sqlalchemy import text
from db import AsyncSessionLocal
from contextvars import ContextVar

current_customer_id: ContextVar[int] = ContextVar("current_customer_id", default=0)

@tool
async def get_customer_package(**kwargs) -> str:
    """Returns the customer's current mobile package."""
    customer_id = current_customer_id.get()
    if not customer_id:
        return "Account tools are not available for this session. Please log in."
        
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT package_name FROM customer_data WHERE customer_id = :id"), {"id": customer_id})
        row = res.fetchone()
        return f"Current package: {row[0]}" if row else "Customer not found."

@tool
async def get_data_balance(**kwargs) -> str:
    """Returns the remaining mobile data in GB."""
    customer_id = current_customer_id.get()
    if not customer_id:
        return "Account tools are not available for this session. Please log in."
        
    # Simulated API failure (10% chance)
    if os.getenv("SIMULATE_TOOL_FAILURES", "false").lower() == "true" and random.random() < 0.1:
        raise Exception("Billing API Timeout: Unable to reach data balance service.")
        
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT data_balance_gb FROM customer_data WHERE customer_id = :id"), {"id": customer_id})
        row = res.fetchone()
        return f"Remaining data: {row[0]} GB" if row else "Customer not found."

@tool
async def create_support_ticket(issue_description: str, **kwargs) -> str:
    """Creates a support ticket for the customer's issue."""
    customer_id = current_customer_id.get()
    if not customer_id:
        return "Account tools are not available for this session. Please log in."
        
    ticket_id = f"TKT-{random.randint(1000, 9999)}"
    async with AsyncSessionLocal() as db:
        await db.execute(
            text("INSERT INTO support_tickets (ticket_id, customer_id, issue_description) VALUES (:tid, :cid, :desc)"),
            {"tid": ticket_id, "cid": customer_id, "desc": issue_description}
        )
        await db.commit()
    return f"Support ticket created successfully. Reference: {ticket_id}"

@tool
async def change_customer_package(new_package: str, confirmed: bool = False, **kwargs) -> str:
    """Changes the customer's package. Requires explicit confirmation."""
    customer_id = current_customer_id.get()
    if not customer_id:
        return "Account tools are not available for this session. Please log in."
        
    valid_packages = {"Basic 10GB", "Smart 20GB", "Ultra 50GB", "Family 100GB"}
    if new_package not in valid_packages:
        return f"Invalid package. Valid options are: {', '.join(valid_packages)}."
        
    if not confirmed:
        return f"CONFIRMATION_REQUIRED: Changing to {new_package} will alter your billing cycle. Please confirm to proceed."
    
    async with AsyncSessionLocal() as db:
        await db.execute(text("UPDATE customer_data SET package_name = :pkg WHERE customer_id = :id"), 
                         {"pkg": new_package, "id": customer_id})
        await db.commit()
    return f"Package successfully changed to {new_package}."