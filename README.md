MCP-Pinecone Demo
This project demonstrates automated vector storage using Pinecone and Cursor’s MCP framework. It converts the text “I love dogs” into a 384-dimensional vector using a SentenceTransformer model and stores it in a Pinecone index (text-demo) in AWS US East (us-east-1). Designed for a presentation to showcase AI-driven semantic search, the project leverages MCP’s natural language automation to simplify index creation and vector upserting, reducing manual coding.
As a beginner in vector databases and Cursor, I built this demo to explore machine learning workflows, overcoming challenges like PowerShell syntax errors, Pinecone API connectivity issues, and JSON payload formatting. This README guides you through setup, usage, and troubleshooting.
Features

Generates a 384-dimensional text embedding using all-MiniLM-L6-v2.
Automates Pinecone index creation and vector upserting via MCP.
Uses Cursor’s chat interface for natural language commands.
Includes PowerShell scripts for manual API interactions.
Stores vectors with metadata (e.g., {"text": "I love dogs"}) for semantic search.

Prerequisites

Node.js (v16+)
Python (3.8+)
Pinecone account with an API key
Cursor IDE for MCP integration
Dependencies:
Node.js: @pinecone-database/pinecone, express
Python: sentence-transformers



Installation

Clone the Repository:
git clone https://github.com/your-username/mcp-pinecone-demo.git
cd mcp-pinecone-demo


Install Node.js Dependencies:
npm install @pinecone-database/pinecone express


Install Python Dependencies:
pip install sentence-transformers


Configure Pinecone API Key:

Copy your API key from app.pinecone.io.
Update mcp_pinecone_server.js:const PINECONE_API_KEY = 'YOUR_API_KEY';


Update .cursor/mcp.json:"env": {
  "PINECONE_API_KEY": "YOUR_API_KEY"
}





Usage

Start the MCP Server:
node mcp_pinecone_server.js


Verify: Starting MCP server... MCP server running on port 3000.


Generate Text Vector:

Run generate_vector.py to create a 384-dimensional vector for “I love dogs”:python generate_vector.py


Output: vector.json with the vector (e.g., [-0.0395260751247406, ...]).


Create Pinecone Index:

In Cursor’s chat interface (Ctrl+Shift+P > “Chat with Codebase”), enter:Create a Pinecone index named 'text-demo' with 384 dimensions using the MCP server.


Or use PowerShell:Invoke-WebRequest -Uri http://localhost:3000/create-index -Method POST -Headers @{ "Content-Type" = "application/json" } -Body '{"indexName":"text-demo","dimension":384}'


Wait 1–2 minutes, then check app.pinecone.io for text-demo.


Upsert Vector:

In Cursor’s chat interface, enter:Upsert a vector to the Pinecone index 'text-demo' with ID 'text_1', vector [YOUR_VECTOR], and metadata {"text": "I love dogs"} using the MCP server.


Replace [YOUR_VECTOR] with the contents of vector.json.


Or use PowerShell:
Create upsert.json:{
  "indexName": "text-demo",
  "records": [
    {
      "id": "text_1",
      "values": [YOUR_VECTOR],
      "metadata": { "text": "I love dogs" }
    }
  ]
}


Run:$body = Get-Content -Path .\upsert.json -Raw
Invoke-WebRequest -Uri http://localhost:3000/upsert-records -Method POST -Headers @{ "Content-Type" = "application/json" } -Body $body






Verify in Pinecone:

Log into app.pinecone.io.
Navigate to text-demo in us-east-1.
Confirm vector text_1 with metadata {"text": "I love dogs"}.



Project Structure
mcp-pinecone-demo/
├── .cursor/
│   └── mcp.json           # MCP configuration with Pinecone API key
├── mcp_pinecone_server.js # Node.js server for MCP-Pinecone integration
├── generate_vector.py     # Python script to generate text embeddings
├── vector.json            # Generated 384-dimensional vector
└── upsert.json            # Optional JSON for vector upserting

Troubleshooting

Pinecone API Connectivity:
Verify PINECONE_API_KEY in mcp_pinecone_server.js and .cursor/mcp.json.
Test connectivity:Invoke-WebRequest -Uri http://localhost:3000/test-pinecone -Method GET


Check status.pinecone.io for outages.
Ensure Node.js has outbound HTTPS access (*.pinecone.io).


PowerShell Syntax Errors:
Use Invoke-WebRequest with hashtable headers: @{ "Content-Type" = "application/json" }.
Validate JSON in upsert.json with an online parser.


Vector Issues:
Ensure vector.json contains 384 values.
Rerun python generate_vector.py if corrupted.


Index Creation Delay:
Wait 1–2 minutes after creating text-demo.
Manually create in app.pinecone.io if needed.


Debugging:
Check MCP server logs in the terminal.
Use Cursor’s search_docs for Pinecone SDK help.



Challenges Overcome

PowerShell Syntax: Adapted Unix curl commands to Invoke-WebRequest with proper headers and JSON.
Pinecone Connectivity: Resolved API key mismatches and network restrictions (e.g., firewall, proxy).
JSON Payload Errors: Fixed records is not iterable by validating JSON structure.
Beginner Learning Curve: Leveraged Cursor’s MCP to automate tasks, reducing manual coding.

Acknowledgments

Pinecone for vector database services.
Cursor for the MCP framework and IDE.
SentenceTransformers for text embeddings.
My supervisor for the opportunity to explore AI automation.

License
MIT License. See LICENSE for details.

Feel free to contribute or reach out with questions! 🚀
