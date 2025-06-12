require('dotenv').config();
const express = require('express');
const { Pinecone } = require('@pinecone-database/pinecone');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || 'your-api-key';

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY
});

// Helper function to generate embeddings using Python
async function generateEmbedding(text) {
  return new Promise((resolve, reject) => {
    const pythonScript = `
from sentence_transformers import SentenceTransformer
import json
import sys

try:
    model = SentenceTransformer('all-MiniLM-L6-v2')
    text = sys.argv[1]
    vector = model.encode(text).tolist()
    print(json.dumps(vector))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    // Write Python script to temp file
    const tempScript = path.join(__dirname, 'temp_embedding.py');
    fs.writeFile(tempScript, pythonScript).then(() => {
      const python = spawn('python', [tempScript, text]);
      let output = '';
      let error = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        error += data.toString();
      });

      python.on('close', async (code) => {
        // Clean up temp file
        try {
          await fs.unlink(tempScript);
        } catch (e) {
          console.warn('Could not delete temp file:', e.message);
        }

        if (code !== 0) {
          reject(new Error(`Python script failed: ${error}`));
          return;
        }

        try {
          const result = JSON.parse(output.trim());
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(new Error(`Failed to parse embedding result: ${e.message}`));
        }
      });
    }).catch(reject);
  });
}

// Home endpoint with API documentation
app.get('/', (req, res) => {
  res.json({
    message: 'Pinecone MCP Server with Text-to-Vector Conversion',
    version: '2.0.0',
    features: [
      'Direct text-to-vector conversion using SentenceTransformers',
      'Automatic embedding generation',
      'Complete Pinecone CRUD operations',
      'Claude/Cursor compatible endpoints'
    ],
    endpoints: {
      'GET /': 'API documentation',
      'GET /health': 'Health check',
      'GET /test-pinecone': 'Test Pinecone connection',
      'POST /add-text': '🚀 Add text directly (auto-generates embedding)',
      'POST /query-text': '🔍 Query using text (auto-generates embedding)',
      'POST /add-multiple-texts': '📚 Add multiple texts at once',
      'GET /list-indexes': 'List all indexes',
      'POST /create-index': 'Create new index',
      'GET /index-stats/:indexName': 'Get index statistics',
      'DELETE /delete-index/:indexName': 'Delete an index'
    },
    usage: {
      addText: 'POST /add-text with {"indexName": "my-index", "text": "Your text here", "metadata": {...}}',
      queryText: 'POST /query-text with {"indexName": "my-index", "text": "Search query", "topK": 5}'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'success', 
    message: 'MCP server is running',
    timestamp: new Date().toISOString(),
    pythonAvailable: true  // We'll assume Python is available
  });
});

// Test Pinecone connection
app.get('/test-pinecone', async (req, res) => {
  try {
    const indexes = await pinecone.listIndexes();
    res.json({ 
      status: 'success', 
      message: 'Pinecone connection successful',
      indexCount: indexes.indexes?.length || 0,
      indexes: indexes.indexes || []
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to connect to Pinecone',
      error: error.message 
    });
  }
});

// 🚀 NEW: Add text directly (Claude-friendly)
app.post('/add-text', async (req, res) => {
  try {
    const { indexName, text, metadata = {}, id } = req.body;
    
    if (!indexName || !text) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing required fields: indexName and text' 
      });
    }

    console.log(`🔄 Generating embedding for: "${text.substring(0, 50)}..."`);
    
    // Generate embedding
    const vector = await generateEmbedding(text);
    
    console.log(`✅ Generated ${vector.length}-dimensional vector`);
    
    // Create unique ID if not provided
    const vectorId = id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add text to metadata
    const enrichedMetadata = {
      ...metadata,
      text: text,
      model: 'all-MiniLM-L6-v2',
      dimension: vector.length,
      timestamp: new Date().toISOString()
    };
    
    // Upsert to Pinecone
    const index = pinecone.Index(indexName);
    await index.upsert([{
      id: vectorId,
      values: vector,
      metadata: enrichedMetadata
    }]);
    
    console.log(`✅ Text added to index '${indexName}' with ID: ${vectorId}`);
    
    res.json({ 
      status: 'success', 
      message: 'Text successfully converted to vector and added to Pinecone',
      data: {
        id: vectorId,
        text: text,
        indexName: indexName,
        vectorDimension: vector.length,
        metadata: enrichedMetadata
      }
    });
    
  } catch (error) {
    console.error('Add text error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: `Failed to add text: ${error.message}` 
    });
  }
});

// 🔍 NEW: Query using text (Claude-friendly)
app.post('/query-text', async (req, res) => {
  try {
    const { indexName, text, topK = 5, includeMetadata = true } = req.body;
    
    if (!indexName || !text) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing required fields: indexName and text' 
      });
    }

    console.log(`🔍 Searching for: "${text}"`);
    
    // Generate query embedding
    const queryVector = await generateEmbedding(text);
    
    console.log(`✅ Generated query vector (${queryVector.length} dimensions)`);
    
    // Query Pinecone
    const index = pinecone.Index(indexName);
    const queryResponse = await index.query({
      vector: queryVector,
      topK: parseInt(topK),
      includeMetadata: includeMetadata
    });
    
    const results = queryResponse.matches || [];
    
    console.log(`✅ Found ${results.length} similar results`);
    
    // Format results for better readability
    const formattedResults = results.map((result, i) => ({
      rank: i + 1,
      id: result.id,
      score: parseFloat(result.score.toFixed(4)),
      text: result.metadata?.text || 'No text available',
      metadata: result.metadata || {}
    }));
    
    res.json({ 
      status: 'success', 
      query: text,
      resultsCount: results.length,
      results: formattedResults
    });
    
  } catch (error) {
    console.error('Query text error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: `Failed to query text: ${error.message}` 
    });
  }
});

// 📚 NEW: Add multiple texts at once
app.post('/add-multiple-texts', async (req, res) => {
  try {
    const { indexName, texts } = req.body;
    
    if (!indexName || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing required fields: indexName and texts (array)' 
      });
    }

    console.log(`📚 Processing ${texts.length} texts for index '${indexName}'`);
    
    const vectors = [];
    const results = [];
    
    for (let i = 0; i < texts.length; i++) {
      const textData = texts[i];
      const text = typeof textData === 'string' ? textData : textData.text;
      const metadata = typeof textData === 'object' ? textData.metadata || {} : {};
      const id = typeof textData === 'object' ? textData.id : null;
      
      try {
        console.log(`🔄 Processing text ${i + 1}/${texts.length}: "${text.substring(0, 30)}..."`);
        
        const vector = await generateEmbedding(text);
        const vectorId = id || `doc_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
        
        const enrichedMetadata = {
          ...metadata,
          text: text,
          model: 'all-MiniLM-L6-v2',
          dimension: vector.length,
          timestamp: new Date().toISOString(),
          batch_index: i
        };
        
        vectors.push({
          id: vectorId,
          values: vector,
          metadata: enrichedMetadata
        });
        
        results.push({
          id: vectorId,
          text: text,
          status: 'processed'
        });
        
      } catch (error) {
        console.error(`❌ Failed to process text ${i + 1}:`, error.message);
        results.push({
          text: text,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    // Upsert all vectors to Pinecone
    if (vectors.length > 0) {
      console.log(`📤 Upserting ${vectors.length} vectors to Pinecone...`);
      const index = pinecone.Index(indexName);
      await index.upsert(vectors);
      console.log(`✅ Successfully upserted ${vectors.length} vectors`);
    }
    
    res.json({ 
      status: 'success', 
      message: `Processed ${texts.length} texts, successfully added ${vectors.length} vectors`,
      indexName: indexName,
      totalTexts: texts.length,
      successfullyAdded: vectors.length,
      failed: texts.length - vectors.length,
      results: results
    });
    
  } catch (error) {
    console.error('Add multiple texts error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: `Failed to add multiple texts: ${error.message}` 
    });
  }
});

// List all indexes
app.get('/list-indexes', async (req, res) => {
  try {
    const indexes = await pinecone.listIndexes();
    res.json({ 
      status: 'success', 
      indexes: indexes.indexes || []
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Create index
app.post('/create-index', async (req, res) => {
  try {
    const { indexName, dimension = 384, metric = 'cosine' } = req.body;
    
    if (!indexName) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing required field: indexName' 
      });
    }
    
    await pinecone.createIndex({
      name: indexName,
      dimension: parseInt(dimension),
      metric: metric,
      spec: { 
        serverless: { 
          cloud: 'aws', 
          region: 'us-east-1' 
        } 
      },
    });
    
    res.json({ 
      status: 'success', 
      message: `Index '${indexName}' created successfully`,
      indexName,
      dimension: parseInt(dimension),
      metric
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Get index stats
app.get('/index-stats/:indexName', async (req, res) => {
  try {
    const { indexName } = req.params;
    const index = pinecone.Index(indexName);
    const stats = await index.describeIndexStats();
    
    res.json({ 
      status: 'success', 
      indexName,
      stats 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Delete index
app.delete('/delete-index/:indexName', async (req, res) => {
  try {
    const { indexName } = req.params;
    await pinecone.deleteIndex(indexName);
    
    res.json({ 
      status: 'success', 
      message: `Index '${indexName}' deleted successfully` 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Start server
console.log(' Starting Advanced Pinecone MCP Server...');
console.log(' Features: Text-to-Vector conversion, Direct Claude integration');

const server = app.listen(PORT, () => {
  console.log(`MCP server running on port ${PORT}`);
  console.log(` Server URL: http://localhost:${PORT}`);
  console.log(' http://localhost:3000 for API documentation');
  console.log('');
  // console.log('🎯 Claude-Ready Endpoints:');
  // console.log('   📝 POST /add-text         - Add text directly');
  // console.log('   🔍 POST /query-text       - Search using text');
  // console.log('   📚 POST /add-multiple-texts - Batch add texts');
  // console.log('   🏗️  POST /create-index     - Create new index');
  // console.log('   📊 GET  /list-indexes      - List all indexes');
//   console.log('');
//   console.log(' Example usage:');
//   console.log('   curl -X POST http://localhost:3000/add-text \\');
//   console.log('     -H "Content-Type: application/json" \\');
//   console.log('     -d \'{"indexName":"my-index","text":"I love dogs"}\'');
});

server.on('error', (error) => {
  console.error('❌ Server failed to start:', error.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down ...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});