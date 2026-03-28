/**
 * Normalizes a phone number to standard E.164 format for India (+91)
 * 1. Strips all non-numeric characters (except leading +)
 * 2. If length is 10, adds +91 prefix
 * 3. If starts with 91 but no +, adds +
 * 4. Ensures no spaces or special characters
 * 
 * @param {string} phoneNumber 
 * @returns {string} Normalized phone number
 */
export const normalizePhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return "";
    
    // Remove all non-numeric characters EXCEPT leading '+'
    let normalized = phoneNumber.replace(/[^\d+]/g, "");

    // If it's 10 digits, assume India (+91)
    if (normalized.length === 10 && !normalized.startsWith("+")) {
        normalized = `+91${normalized}`;
    }

    // If it starts with 91 (12 digits) but no +, add +
    if (normalized.length === 12 && normalized.startsWith("91")) {
        normalized = `+${normalized}`;
    }

    return normalized;
};
