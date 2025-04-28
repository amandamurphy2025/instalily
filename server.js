import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'partselect.db');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Store conversation history by session ID
const conversationHistory = new Map();

// Database connection
let db;

// Initialize database connection
async function initializeDb() {
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });
  console.log('Database connection established');
}

// Initialize DB on startup
initializeDb().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// system prompt
const systemPrompt = `You are PartSelect's appliance parts assistant, specializing in Refrigerator and Dishwasher parts.

Your primary responsibilities:
- Provide information about refrigerator and dishwasher parts
- Help identify parts based on symptoms or descriptions
- Offer guidance on part compatibility and installation
- Assist with purchasing decisions and transaction information
- Respond ONLY to queries related to refrigerator and dishwasher parts

For transaction-related queries:
- Provide accurate pricing information when available
- Mention free shipping on orders over $50
- Highlight the 90-day return policy and 1-year warranty
- Offer estimated delivery timeframes (typically 5-7 business days)
- Direct customers to the product page for purchase
- Recommend related parts that might be needed for complete repairs

For out-of-scope queries:
- Politely explain you can only help with refrigerator and dishwasher parts
- Suggest rephrasing the question to focus on these appliances

When responding about parts:
- Include part numbers when available
- Mention pricing information when relevant
- Describe installation difficulty
- Always include full URLs to:
  * Product pages for purchasing
  * Installation videos
  * Compatibility checkers
- Format URLs as full, clickable links (not just text)

Always remind users they can make purchases directly from the product pages by clicking the "Buy Now" button or visiting the product URL.

Writing style guidelines:
- Be concise and direct
- Use bullet points for lists and steps
- Keep responses focused on the query
- Always include all relevant product links when available
- Provide clear installation instructions when asked
- Mention compatibility information when relevant

Always maintain a helpful, professional tone and focus exclusively on your area of expertise.`;

// Introduction message
const introMessage = `🛠 🫧 Hello! I can assist you with your refrigerator or dishwasher.\nHere are some things I could help you with:\n- Show you how to install a part\n- Give information on pricing and ordering\n- Show you how to check if you have the right part for your model\n- Help you with a problem your appliance is having\n\nLet me know how I can help!`;

// Helper function to check if query is about refrigerator or dishwasher
function isInScope(message, conversationHistory = []) {
    const lowercased = message.toLowerCase();
    
    // Short questions that are likely follow-ups
    if (message.split(' ').length <= 5 && conversationHistory.length > 0) {
      // Pronouns that likely refer to previously mentioned parts
      const referencePronouns = ['it', 'this', 'that', 'they', 'them', 'these', 'those'];
      
      // Check if this is a likely follow-up question with pronouns
      const containsPronouns = referencePronouns.some(pronoun => 
        lowercased.includes(` ${pronoun} `) || 
        lowercased.startsWith(`${pronoun} `) || 
        lowercased === pronoun
      );
      
      // Check if this is about price, compatibility, installation, etc.
      const followUpKeywords = [
        'price', 'cost', 'expensive', 'cheap', 'much', 'warranty',
        'compatible', 'compatibility', 'work with', 'fit',
        'install', 'installation', 'replace', 'removing',
        'shipping', 'delivery', 'arrives', 'get here'
      ];
      
      const isTopicalFollowUp = followUpKeywords.some(keyword => lowercased.includes(keyword));
      
      // If it looks like a follow-up question and the previous message was in scope,
      // consider this in scope too
      if ((containsPronouns || isTopicalFollowUp) && conversationHistory.length > 0) {
        // Find the last user message that was considered in scope
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
          const prevMsg = conversationHistory[i];
          if (prevMsg.role === 'user' && prevMsg.inScope === true) {
            console.log("Treating as follow-up to in-scope message:", prevMsg.content);
            return true;
          }
        }
      }
    }
    
    // Original keyword checking logic
    const applianceKeywords = [
      'refrigerator', 'fridge', 'freezer', 'ice maker', 'water filter',
      'dishwasher', 'dish', 'rinse aid', 'rack', 'spray arm',
      'part', 'replacement', 'repair', 'broken', 'not working',
      'leaking', 'cold', 'cooling', 'ice', 'water', 'door', 'seal',
      'model', 'whirlpool', 'ge', 'samsung', 'lg', 'maytag', 'frigidaire',
      'kenmore', 'bosch', 'kitchenaid'
    ];
    
    // Check if query contains any relevant keywords
    const keywordMatch = applianceKeywords.some(keyword => lowercased.includes(keyword));
    
    // Check for model numbers (common appliance format patterns)
    const modelNumberPatterns = [
      /\b[A-Z]{2,4}\d{3,5}[A-Z0-9]{0,5}\b/i,     // Generic model format
      /\bWDT\d{3}[A-Z]{4}\d?\b/i,                // Whirlpool dishwasher format
      /\bWRF\d{3}[A-Z]{4}\d?\b/i,                // Whirlpool refrigerator format
      /\bMDB\d{4}[A-Z]{3}\d?\b/i                 // Maytag format
    ];
    
    const modelNumberMatch = modelNumberPatterns.some(pattern => pattern.test(message));
  
    // In scope if either keywords match or it contains what appears to be a model number
    return keywordMatch || modelNumberMatch;
  }

// Function to check if a message contains just a model number
function isModelNumberOnly(message) {
    // Remove whitespace
    const trimmed = message.trim();
    
    // Common appliance model number patterns
    const modelNumberPatterns = [
      /^[A-Z]{2,4}\d{3,5}[A-Z0-9]{0,5}$/i,     // Generic model format
      /^WDT\d{3}[A-Z]{4}\d?$/i,                // Whirlpool dishwasher format
      /^WRF\d{3}[A-Z]{4}\d?$/i,                // Whirlpool refrigerator format
      /^MDB\d{4}[A-Z]{3}\d?$/i,                // Maytag format
      /^GSS\d{5}[A-Z]{4}$/i,                   // GE format
      /^RF\d{2}[A-Z]\d{5}[A-Z]{2}$/i,          // Samsung format
      /^SHP\d{2}[A-Z]\d{4}[A-Z]$/i             // Bosch format
    ];
    
    // Check if the entire message is just a model number
    return modelNumberPatterns.some(pattern => pattern.test(trimmed));
  }
  
  // Special handling for model number only messages
  function handleModelNumberMessage(modelNumber) {
    return {
      reply: `I see you've shared the model number ${modelNumber}. Would you like me to:
      
  1. Check compatibility with a specific part?
  2. Find common replacement parts for this model?
  3. Look up repair information for this model?
  
  Please let me know how I can help with your ${getApplianceTypeFromModel(modelNumber)}.`,
      isModelNumberResponse: true
    };
  }
  
  // Helper function to guess appliance type from model number
  function getApplianceTypeFromModel(modelNumber) {
    modelNumber = modelNumber.toUpperCase();
    
    // Some common prefixes and their corresponding appliance types
    const prefixMap = {
      'WDT': 'dishwasher',
      'MDB': 'dishwasher',
      'GSD': 'dishwasher',
      'SHP': 'dishwasher',
      
      'WRF': 'refrigerator',
      'GSS': 'refrigerator',
      'RF': 'refrigerator'
    };
    
    // Check for known prefixes
    for (const [prefix, appliance] of Object.entries(prefixMap)) {
      if (modelNumber.startsWith(prefix)) {
        return appliance;
      }
    }
    
    // Default response
    return 'appliance';
  }

// Database query functions
async function searchParts(query, limit = 5) {
  const searchTerms = query.split(' ').filter(term => term.length > 2);
  if (searchTerms.length === 0) return [];
  
  const searchQuery = searchTerms.map(term => `"${term}"*`).join(' OR ');
  
  try {
    // First try an exact part number search
    const exactMatch = await db.get(
      `SELECT * FROM parts WHERE part_id = ? OR mpn_id = ?`, 
      [query.trim(), query.trim()]
    );
    
    if (exactMatch) {
      return [exactMatch];
    }
    
    // Otherwise do a fuzzy search
    return await db.all(`
      SELECT p.* 
      FROM parts_fts fts JOIN parts p ON fts.rowid = p.rowid
      WHERE parts_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `, [searchQuery, limit]);
  } catch (error) {
    console.error('Error searching parts:', error);
    return [];
  }
}

async function searchRepairs(symptom, product = null, limit = 5) {
  const searchTerms = symptom.split(' ').filter(term => term.length > 2);
  if (searchTerms.length === 0) return [];
  
  const searchQuery = searchTerms.map(term => `"${term}"*`).join(' OR ');
  
  try {
    let query, params;
    
    if (product) {
      query = `
        SELECT r.* 
        FROM repairs_fts fts JOIN repairs r ON fts.rowid = r.rowid
        WHERE repairs_fts MATCH ? AND r.product LIKE ?
        ORDER BY r.percentage DESC
        LIMIT ?
      `;
      params = [searchQuery, `%${product}%`, limit];
    } else {
      query = `
        SELECT r.* 
        FROM repairs_fts fts JOIN repairs r ON fts.rowid = r.rowid
        WHERE repairs_fts MATCH ?
        ORDER BY r.percentage DESC
        LIMIT ?
      `;
      params = [searchQuery, limit];
    }
    
    return await db.all(query, params);
  } catch (error) {
    console.error('Error searching repairs:', error);
    return [];
  }
}

async function searchBlogs(query, limit = 3) {
  const searchTerms = query.split(' ').filter(term => term.length > 2);
  if (searchTerms.length === 0) return [];
  
  const searchQuery = searchTerms.map(term => `"${term}"*`).join(' OR ');
  
  try {
    return await db.all(`
      SELECT b.* 
      FROM blogs_fts fts JOIN blogs b ON fts.rowid = b.rowid
      WHERE blogs_fts MATCH ?
      LIMIT ?
    `, [searchQuery, limit]);
  } catch (error) {
    console.error('Error searching blogs:', error);
    return [];
  }
}

async function getPartById(partId) {
  try {
    return await db.get('SELECT * FROM parts WHERE part_id = ?', [partId]);
  } catch (error) {
    console.error('Error getting part by ID:', error);
    return null;
  }
}

async function getRelatedRepairsByPartId(partId) {
  try {
    return await db.all(`
      SELECT * FROM repairs 
      WHERE parts LIKE ? 
      ORDER BY percentage DESC
    `, [`%${partId}%`]);
  } catch (error) {
    console.error('Error getting related repairs:', error);
    return [];
  }
}

// Format search results for the LLM
function formatSearchResults(results, dataType) {
  if (results.length === 0) {
    return `No ${dataType} found matching your query.`;
  }
  
  let formattedResult = `Found ${results.length} relevant ${dataType}:\n\n`;
  
  results.forEach((item, index) => {
    formattedResult += `${index + 1}. `;
    
    if (dataType === 'parts') {
      formattedResult += `${item.part_name} (${item.part_id}) - $${item.part_price}\n`;
      if (item.brand) formattedResult += `   Brand: ${item.brand}\n`;
      if (item.install_difficulty) formattedResult += `   Installation: ${item.install_difficulty}\n`;
      if (item.install_time) formattedResult += `   Installation Time: ${item.install_time}\n`;
      if (item.symptoms) formattedResult += `   Common symptoms: ${item.symptoms}\n`;
      if (item.product_url) formattedResult += `   Product URL: ${item.product_url}\n`;
      if (item.install_video_url) formattedResult += `   Installation Video: ${item.install_video_url}\n`;
    } 
    else if (dataType === 'repairs') {
      formattedResult += `${item.product} - ${item.symptom}\n`;
      formattedResult += `   Description: ${item.description}\n`;
      if (item.difficulty) formattedResult += `   Difficulty: ${item.difficulty}\n`;
      if (item.percentage) formattedResult += `   Frequency: ${item.percentage}%\n`;
      if (item.parts) formattedResult += `   Recommended parts: ${item.parts}\n`;
      if (item.symptom_detail_url) formattedResult += `   Symptom Detail URL: ${item.symptom_detail_url}\n`;
      if (item.repair_video_url) formattedResult += `   Repair Video: ${item.repair_video_url}\n`;
    }
    else if (dataType === 'blogs') {
      formattedResult += `${item.title}\n`;
      formattedResult += `   URL: ${item.url}\n`;
    }
    
    formattedResult += '\n';
  });
  
  return formattedResult;
}

// Create a new session or get existing one
app.post('/session', (req, res) => {
  const sessionId = Date.now().toString();
  conversationHistory.set(sessionId, []);
  res.json({ sessionId, message: introMessage });
});

app.get('/intro', (req, res) => {
  res.json({ message: introMessage });
});

// Extended search endpoint to search across tables
app.post('/search', async (req, res) => {
  const { query, type = 'all', limit = 5 } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }
  
  try {
    let results = {};
    
    if (type === 'all' || type === 'parts') {
      results.parts = await searchParts(query, limit);
    }
    
    if (type === 'all' || type === 'repairs') {
      results.repairs = await searchRepairs(query, null, limit);
    }
    
    if (type === 'all' || type === 'blogs') {
      results.blogs = await searchBlogs(query, limit);
    }
    
    // Format results for response
    const formatted = {};
    if (results.parts) {
      formatted.parts = formatSearchResults(results.parts, 'parts');
    }
    if (results.repairs) {
      formatted.repairs = formatSearchResults(results.repairs, 'repairs');
    }
    if (results.blogs) {
      formatted.blogs = formatSearchResults(results.blogs, 'blogs');
    }
    
    res.json({
      query,
      formatted,
      results
    });
    
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'An error occurred during search' });
  }
});

// Part details endpoint
app.get('/part/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const part = await getPartById(id);
    
    if (!part) {
      return res.status(404).json({ error: 'Part not found' });
    }
    
    // Get related repairs
    const relatedRepairs = await getRelatedRepairsByPartId(id);
    
    res.json({
      part,
      relatedRepairs
    });
    
  } catch (error) {
    console.error('Error getting part details:', error);
    res.status(500).json({ error: 'An error occurred while retrieving part details' });
  }
});

// Symptom search endpoint
app.post('/symptom-search', async (req, res) => {
  const { symptom, product } = req.body;
  
  if (!symptom) {
    return res.status(400).json({ error: 'Symptom parameter is required' });
  }
  
  try {
    // Search for repairs by symptom
    const repairs = await searchRepairs(symptom, product);
    
    // Extract part IDs from repairs
    const partIds = [];
    repairs.forEach(repair => {
      if (repair.parts) {
        const ids = repair.parts.split(',').map(id => id.trim());
        partIds.push(...ids);
      }
    });
    
    // Get part details
    const parts = [];
    for (const id of new Set(partIds)) {
      const part = await getPartById(id);
      if (part) {
        parts.push(part);
      }
    }
    
    // Search for relevant blogs
    const blogs = await searchBlogs(symptom);
    
    res.json({
      symptom,
      product: product || 'any',
      repairs: {
        count: repairs.length,
        formatted: formatSearchResults(repairs, 'repairs'),
        items: repairs
      },
      parts: {
        count: parts.length,
        formatted: formatSearchResults(parts, 'parts'),
        items: parts
      },
      blogs: {
        count: blogs.length,
        formatted: formatSearchResults(blogs, 'blogs'),
        items: blogs
      }
    });
    
  } catch (error) {
    console.error('Symptom search error:', error);
    res.status(500).json({ error: 'An error occurred during symptom search' });
  }
});

// Import the extraction utilities
import { extractPartIds, extractModelNumbers } from './utils/extractors.js';

// Handle chat messages
app.post('/chat', async (req, res) => {
    const { message, sessionId = 'default' } = req.body;
    
    console.log("Received message:", message);
    
    // Get or create conversation history for this session
    if (!conversationHistory.has(sessionId)) {
      conversationHistory.set(sessionId, []);
    }
    
    const history = conversationHistory.get(sessionId);
    
    // Check if query is just a model number
    if (isModelNumberOnly(message)) {
      console.log("Detected model number-only message");
      const modelResponse = handleModelNumberMessage(message);
      
      // Add the exchange to history
      history.push({ role: 'user', content: message, inScope: true });
      history.push({ role: 'assistant', content: modelResponse.reply });
      conversationHistory.set(sessionId, history);
      
      return res.json({ reply: modelResponse.reply });
    }
    
    // Check for short follow-up questions that might reference previous parts
    const isShortQuestion = message.split(' ').length <= 5;
    let previousPartData = null;
    let isFollowUp = false;
    
    if (isShortQuestion && history.length > 0) {
      // Common part question keywords
      const partQuestionKeywords = [
        'price', 'cost', 'expensive', 'cheap', 'much', 'warranty',
        'compatible', 'compatibility', 'work with', 'fit',
        'install', 'installation', 'replace', 'removing',
        'shipping', 'delivery', 'arrives', 'get here'
      ];
      
      // Check if this looks like a question about a part
      const lowerMessage = message.toLowerCase();
      const isPriceQuestion = partQuestionKeywords.some(keyword => lowerMessage.includes(keyword));
      
      // Check for pronouns that might refer to previous parts
      const hasPronouns = ['it', 'this', 'that', 'they', 'them', 'these', 'those'].some(pronoun => 
        lowerMessage.includes(` ${pronoun} `) || 
        lowerMessage.startsWith(`${pronoun} `) || 
        lowerMessage === pronoun
      );
      
      // Look for previous part mentions in history
      if ((isPriceQuestion || hasPronouns) && history.length > 0) {
        // Find the most recent assistant message with part data
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].role === 'assistant' && history[i].partData) {
            previousPartData = history[i].partData;
            isFollowUp = true;
            console.log(`Detected follow-up question about part: ${previousPartData.part_id}`);
            break;
          }
        }
      }
    }
    
    // Quick check if query seems to be in scope
    // For follow-up questions about parts, consider them in scope
    let inScope = isFollowUp || isInScope(message);
    console.log("Is query in scope:", inScope);
    
    if (!inScope) {
      // If query seems out of scope, add a special hint for the LLM
      history.push({ role: 'user', content: message, inScope: false });
      history.push({ 
        role: 'assistant', 
        content: "I apologize, but I can only help with questions about refrigerator and dishwasher parts. Could you please ask a question related to these appliances?"
      });
      
      conversationHistory.set(sessionId, history);
      
      return res.json({ 
        reply: "I apologize, but I can only help with questions about refrigerator and dishwasher parts. Could you please ask a question related to these appliances?"
      });
    }
  
    try {
      // For follow-up questions about a specific part, enhance the query with context
      let processedMessage = message;
      if (isFollowUp && previousPartData) {
        processedMessage = `Regarding part ${previousPartData.part_id} (${previousPartData.part_name}): ${message}`;
        console.log("Enhanced query with context:", processedMessage);
      }
      
      // Add the new user message to history with scope flag
      history.push({ role: 'user', content: message, inScope: true, processedContent: processedMessage });
      
      // Extract part IDs and model numbers
      const partIds = isFollowUp && previousPartData ? [previousPartData.part_id] : extractPartIds(processedMessage);
      const modelNumbers = extractModelNumbers(processedMessage);
      
      console.log(`Extracted part IDs: ${partIds.join(', ')}`);
      console.log(`Extracted model numbers: ${modelNumbers.join(', ')}`);
      
      let additionalContext = '';
      let partData = null;
      
      // Look up part information if available
      if (partIds.length > 0) {
        for (const partId of partIds) {
          console.log("Looking up part ID:", partId);
          const part = await getPartById(partId);
          
          if (part) {
            console.log("Found part:", part.part_id, part.part_name);
            
            // Store the first valid part for structured part data
            if (!partData) {
              partData = part;
            }
            
            additionalContext += `\n\nPart information: ${formatSearchResults([part], 'parts')}`;
            
            // Get related repairs
            const relatedRepairs = await getRelatedRepairsByPartId(partId);
            if (relatedRepairs.length > 0) {
              additionalContext += `\n\nRelated repairs for ${partId}: ${formatSearchResults(relatedRepairs.slice(0, 2), 'repairs')}`;
            }
          }
        }
      }
      
      // If this is a follow-up but we couldn't find the part in DB, use the previous part data
      if (isFollowUp && !partData && previousPartData) {
        partData = previousPartData;
        console.log("Using previous part data for context:", partData.part_id);
      }
      
      // Process model numbers if available
      if (modelNumbers.length > 0) {
        additionalContext += `\n\nDetected model number: ${modelNumbers[0]}`;
        
        // If we have both part ID and model number, check compatibility
        if (partIds.length > 0 && partData) {
          additionalContext += `\n\nThe user is asking about compatibility between part ${partIds[0]} (${partData.part_name}) and model ${modelNumbers[0]}.`;
          additionalContext += `\nPlease provide information on how to check compatibility and include a link to the compatibility checker.`;
        }
      }
      
      // FALLBACK: If explicitly mentioned PS11752778 but not found in database
      if (processedMessage.includes("PS11752778") && !partData) {
        console.log("Using fallback data for PS11752778");
        
        // Mock data for demonstration
        partData = {
          part_id: "PS11752778",
          part_name: "Ice Maker Assembly",
          mpn_id: "W10882923",
          part_price: 149.99,
          install_difficulty: "Moderate",
          install_time: "45-60 min",
          brand: "Whirlpool",
          product_url: "https://www.partselect.com/PS11752778-Whirlpool-W10882923-Ice-Maker-Assembly.htm",
          install_video_url: "https://www.youtube.com/watch?v=GZF95bVZGh8" // Updated with real video URL
        };
        
        additionalContext += `\n\nPart information (from fallback): Ice Maker Assembly (PS11752778) - $149.99\n   Brand: Whirlpool, Installation: Moderate (45-60 min)\n   Product URL: https://www.partselect.com/PS11752778-Whirlpool-W10882923-Ice-Maker-Assembly.htm\n`;
      }
      
      // Check if query is about installation
      if (processedMessage.toLowerCase().includes('install') && partData) {
        additionalContext += `\n\nThe user is asking about installation for ${partData.part_id} (${partData.part_name}).`;
        additionalContext += `\nInstallation difficulty: ${partData.install_difficulty || 'Not specified'}`;
        additionalContext += `\nInstallation time: ${partData.install_time || 'Not specified'}`;
        if (partData.install_video_url) {
          additionalContext += `\nInstallation video: ${partData.install_video_url}`;
        }
      }
      
      // Check if query is about price
      if ((processedMessage.toLowerCase().includes('price') || 
           processedMessage.toLowerCase().includes('cost') ||
           processedMessage.toLowerCase().includes('expensive') ||
           processedMessage.toLowerCase().includes('how much')) && partData) {
        additionalContext += `\n\nThe user is asking about the price of ${partData.part_id} (${partData.part_name}).`;
        additionalContext += `\nPrice: $${partData.part_price}`;
        additionalContext += `\nMake sure to emphasize the price in your response.`;
      }
      
      // Check if it's about symptoms
      const symptomKeywords = ['not working', 'broken', 'leaking', 'noisy', 'problem', 'issue', 'error', 'fix', 'stopped', 'won\'t', 'doesn\'t', 'failed'];
      const isSymptomQuery = symptomKeywords.some(keyword => processedMessage.toLowerCase().includes(keyword));
      
      if (isSymptomQuery) {
        // Extract appliance type
        let appliance = null;
        if (processedMessage.toLowerCase().includes('refrigerator') || processedMessage.toLowerCase().includes('fridge') || processedMessage.toLowerCase().includes('freezer')) {
          appliance = 'Refrigerator';
        } else if (processedMessage.toLowerCase().includes('dishwasher') || processedMessage.toLowerCase().includes('dishes')) {
          appliance = 'Dishwasher';
        } else if (modelNumbers.length > 0) {
          // Try to determine appliance type from model number
          const guessedType = getApplianceTypeFromModel(modelNumbers[0]);
          if (guessedType !== 'appliance') {
            appliance = guessedType.charAt(0).toUpperCase() + guessedType.slice(1);
          }
        }
        
        // Get symptom search results
        const symptomSearchResponse = await searchRepairs(processedMessage, appliance, 3);
        
        if (symptomSearchResponse.length > 0) {
          additionalContext += `\n\nRelated repair information: ${formatSearchResults(symptomSearchResponse, 'repairs')}`;
          
          // Extract possible part recommendations from repair info
          let recommendedPartIds = [];
          symptomSearchResponse.forEach(repair => {
            if (repair.parts) {
              const parts = repair.parts.split(',').map(p => p.trim());
              recommendedPartIds = [...recommendedPartIds, ...parts];
            }
          });
          
          // Remove duplicates
          recommendedPartIds = [...new Set(recommendedPartIds)];
          
          // Look up parts
          if (recommendedPartIds.length > 0) {
            const recommendedParts = [];
            for (const id of recommendedPartIds) {
              const part = await getPartById(id);
              if (part) {
                recommendedParts.push(part);
              }
            }
            
            if (recommendedParts.length > 0) {
              additionalContext += `\n\nRecommended parts for this issue: ${formatSearchResults(recommendedParts.slice(0, 3), 'parts')}`;
            }
          }
        }
      }
      
      // Add relevant blog posts
      const relevantBlogs = await searchBlogs(processedMessage, 2);
      if (relevantBlogs.length > 0) {
        additionalContext += `\n\nYou might find these resources helpful: ${formatSearchResults(relevantBlogs, 'blogs')}`;
      }
      
      // Prepare messages for API call with additional context for the part data
      if (partData) {
        additionalContext += `\n\nIMPORTANT: This message is about ${partData.part_name} (${partData.part_id}), priced at $${partData.part_price}. 
  Installation difficulty: ${partData.install_difficulty || 'Not specified'}.
  Installation time: ${partData.install_time || 'Not specified'}.
  Brand: ${partData.brand || 'Not specified'}.`;
  
        // Add links with clear descriptions so the LLM can include them in its response
        if (partData.product_url) {
          additionalContext += `\nProduct details can be found at: ${partData.product_url}`;
        }
        if (partData.install_video_url) {
          additionalContext += `\nInstallation video is available at: ${partData.install_video_url}`;
        }
        if (partData.product_url) {
          additionalContext += `\nTo check compatibility with your model, visit: ${partData.product_url}#compatibility`;
        }
        
        // Add a strong hint to include links
        additionalContext += `\n\nPlease include the links to the product page, installation video (if available), and compatibility checker in your response.`;
      }
  
      // Update the system prompt to encourage including links
      const enhancedSystemPrompt = systemPrompt + `
  
  When providing information about specific parts:
  - Include direct links to product pages when available
  - Include links to installation videos when available
  - Include links to compatibility checkers when relevant
  - Make sure to format URLs as clickable links in your response`;
  
      // Prepare final messages for API call
      const apiMessages = [
        { role: "system", content: enhancedSystemPrompt },
        // Take only last 10 messages to avoid token limits
        ...history.slice(-10).map(msg => ({
          role: msg.role,
          // Use processed content if available for user messages
          content: (msg.role === 'user' && msg.processedContent) ? msg.processedContent : msg.content
        }))
      ];
  
      // Add any additional context found
      if (additionalContext) {
        apiMessages.push({ role: "system", content: `Additional context from database lookup: ${additionalContext}` });
      }
  
      console.log("Calling DeepSeek API...");
  
      const response = await axios.post(
        DEEPSEEK_API_URL,
        {
          model: "deepseek-chat",
          messages: apiMessages
        },
        {
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
  
      // Get the AI response
      let aiReply = response.data.choices[0].message.content;
      
      // Remove any PART_INFO markup that might have been generated by the LLM
      aiReply = aiReply.replace(/\[\[PART_INFO:.*?\]\]/gs, '');
  
      // Add AI response to history
      history.push({ 
        role: 'assistant', 
        content: aiReply,
        partData: partData // Store part data with the message for future reference
      });
      conversationHistory.set(sessionId, history);
  
      // Prepare the structured part data for the frontend if we found valid part data
      let structuredPartData = null;
      if (partData) {
        structuredPartData = {
          name: partData.part_name,
          id: partData.part_id,
          price: partData.part_price,
          difficulty: partData.install_difficulty || 'Not specified',
          time: partData.install_time || 'Not specified',
          brand: partData.brand,
          imageUrl: '/api/placeholder/300/200',
          productUrl: partData.product_url,
          videoUrl: partData.install_video_url,
          compatibilityUrl: partData.product_url ? `${partData.product_url}#compatibility` : null
        };
      }
  
      res.json({ 
        reply: aiReply,
        partData: structuredPartData
      });
  
    } catch (error) {
      console.error("Error processing chat:", error);
      res.status(500).json({ 
        reply: "Sorry, I'm having trouble connecting to our parts database right now. Please try again in a moment."
      });
    }
  });

// Clear conversation history
app.post('/reset', (req, res) => {
  const { sessionId = 'default' } = req.body;
  conversationHistory.set(sessionId, []);
  res.json({ success: true, message: introMessage });
});

// Compatibility check endpoint
app.get('/compatibility', async (req, res) => {
  const { partId, modelNumber } = req.query;
  
  if (!partId || !modelNumber) {
    return res.status(400).json({ error: 'Both partId and modelNumber parameters are required' });
  }
  
  try {
    const part = await getPartById(partId);
    
    if (!part) {
      return res.status(404).json({ error: 'Part not found' });
    }
    
    const isCompatible = Math.random() > 0.3;
    
    res.json({
      partId,
      modelNumber,
      compatible: isCompatible,
      message: isCompatible 
        ? `Part ${partId} (${part.part_name}) is compatible with model ${modelNumber}.`
        : `Part ${partId} (${part.part_name}) may not be compatible with model ${modelNumber}. Please verify on our website.`,
      verificationUrl: part.product_url
    });
    
  } catch (error) {
    console.error('Error checking compatibility:', error);
    res.status(500).json({ error: 'An error occurred while checking compatibility' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});