from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key="AIzaSyAHTJPnxLypztCrC2-bkATP8KDVtj6Cjuk"
)

response = llm.invoke("Say hello")
print(response.content)
