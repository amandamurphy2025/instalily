/**
 * Extracts potential part IDs from a user message
 * @param {string} message - The user's message
 * @returns {string[]} - Array of extracted part IDs
 */
function extractPartIds(message) {
    console.log("Extracting part IDs from message:", message);
    const partIds = [];
    
    // Common part ID patterns
    const patterns = [
      // PartSelect PS format (highest priority)
      {
        pattern: /\b(PS\d{8})\b/gi,
        description: "PartSelect PS format"
      },
      
      // Direct mention with "part number" or "part #"
      {
        pattern: /part(?:\s+number|\s+#)?\s+([A-Za-z0-9]{5,12})/gi,
        description: "Direct mention with part number"
      },
      
      // Alphanumeric part numbers with common prefixes
      {
        pattern: /\b([A-Z0-9]{2,5}\d{5,10})\b/gi,
        description: "Alphanumeric with prefix"
      },
      
      // Whirlpool/Maytag format part numbers
      {
        pattern: /\b(W10\d{6}|WP\d{8}|W\d{8})\b/gi,
        description: "Whirlpool/Maytag format"
      },
      
      // Samsung format
      {
        pattern: /\b(DA\d{2}-\d{5}[A-Z]?)\b/gi,
        description: "Samsung format"
      },
      
      // Bosch format
      {
        pattern: /\b(00\d{6})\b/gi,
        description: "Bosch format"
      }
    ];
    
    // Apply each pattern and collect all matches
    patterns.forEach(({pattern, description}) => {
      // Reset pattern's lastIndex property to ensure it starts from the beginning
      pattern.lastIndex = 0;
      
      let match;
      while ((match = pattern.exec(message)) !== null) {
        console.log(`Found match using ${description}:`, match[1]);
        partIds.push(match[1]);
      }
    });
    
    // Additional direct check for PS followed by 8 digits
    const psMatch = message.match(/\bPS\d{8}\b/i);
    if (psMatch && !partIds.includes(psMatch[0])) {
      console.log("Found direct PS match:", psMatch[0]);
      partIds.push(psMatch[0]);
    }
    
    // Return unique part IDs found
    const uniquePartIds = [...new Set(partIds)];
    console.log("Final unique part IDs:", uniquePartIds);
    return uniquePartIds;
  }
  
  /**
   * Extracts potential model numbers from a user message
   * @param {string} message - The user's message
   * @returns {string[]} - Array of extracted model numbers
   */
  function extractModelNumbers(message) {
    console.log("Extracting model numbers from message:", message);
    const modelNumbers = [];
    
    // Common model number patterns
    const patterns = [
      // Direct mention with "model"
      {
        pattern: /model(?:\s+number|\s+#)?\s+([A-Za-z0-9]{5,15})/gi,
        description: "Direct mention with model"
      },
      
      // Whirlpool/Maytag style models with specific format
      {
        pattern: /\b(WRF\d{3}[A-Z]{4}\d?|MDB\d{4}[A-Z]{3}\d?)\b/gi,
        description: "Whirlpool/Maytag format"
      },
      
      // GE/Hotpoint format
      {
        pattern: /\b(GSS\d{5}[A-Z]{4}|HSM\d{5}[A-Z]{4})\b/gi,
        description: "GE/Hotpoint format"
      },
      
      // Samsung format (often has sections separated by hyphens)
      {
        pattern: /\b(RF\d{2}[A-Z]\d{5}[A-Z]{2})\b/gi,
        description: "Samsung format"
      },
      
      // Generic model patterns (less specific, lower priority)
      {
        pattern: /\b([A-Z]{2,4}\d{3,5}[A-Z0-9]{0,5})\b/gi,
        description: "Generic alphanumeric format"
      }
    ];
    
    // Apply each pattern and collect matches
    patterns.forEach(({pattern, description}) => {
      // Reset pattern's lastIndex property
      pattern.lastIndex = 0;
      
      let match;
      while ((match = pattern.exec(message)) !== null) {
        console.log(`Found model match using ${description}:`, match[1]);
        modelNumbers.push(match[1]);
      }
    });
    
    // Return unique model numbers
    const uniqueModelNumbers = [...new Set(modelNumbers)];
    console.log("Final unique model numbers:", uniqueModelNumbers);
    return uniqueModelNumbers;
  }
  
  export { extractPartIds, extractModelNumbers };