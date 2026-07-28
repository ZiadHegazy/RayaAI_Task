import asyncio
import json
import httpx

async def run_test():
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=180.0) as client:
        # Login
        res = await client.post("/api/login", json={"username": "user1", "password": "password"})
        if res.status_code != 200:
            print("Login failed")
            return
        token = res.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Clear history
        await client.delete("/api/history", headers=headers)
        
        history = []
        
        async def chat(msg):
            nonlocal history
            res = await client.post("/api/chat", json={"message": msg, "history": history}, headers=headers)
            ans = res.json()["response"]
            history.append({"role": "user", "content": msg})
            history.append({"role": "assistant", "content": ans})
            return ans

        print("=== Test 1: Nonexistent package ===")
        ans = await chat("Change my package to Mega 1000GB")
        print("AI:", ans)
        
        print("\n=== Test 2: Mid-confirmation interrupt ===")
        ans = await chat("Change my package to Family 100GB")
        print("AI:", ans)
        
        ans = await chat("Actually wait, what is the weather today?")
        print("AI:", ans)
        
        ans = await chat("yes, confirm")
        print("AI:", ans)
        
        print("\n=== Test 3: Off-topic RAG ===")
        ans = await chat("Tell me about the history of the Roman Empire")
        print("AI:", ans)

if __name__ == "__main__":
    asyncio.run(run_test())
