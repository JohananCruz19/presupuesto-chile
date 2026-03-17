/**
 * Chilean Salary Calculator Logic
 * Based on 2024/2025 Standards
 */

export const CONSTANTS = {
    AFP_RATE: 0.11, // Average 11% (10% + commission)
    HEALTH_RATE: 0.07, // 7% Mandatory
    UNEMPLOYMENT_INDEFINITE: 0.006, // 0.6%
    UNEMPLOYMENT_FIXED: 0.0, // 0%
    MAX_TAXABLE_BASE_UF: 84.3, // Tope Imponible (approx)
    UF_VALUE: 38000 // Approx value for calculation limits
};

// Tax Brackets (Tramo Impuesto Único - Monthly)
// Values are approximate in CLP for 2024
const TAX_BRACKETS = [
    { limit: 890000, factor: 0, deduction: 0 },
    { limit: 1980000, factor: 0.04, deduction: 35600 },
    { limit: 3300000, factor: 0.08, deduction: 114800 },
    { limit: 4620000, factor: 0.135, deduction: 296300 },
    { limit: 5940000, factor: 0.23, deduction: 735200 },
    { limit: 7920000, factor: 0.304, deduction: 1174760 },
    { limit: 20000000, factor: 0.35, deduction: 1539080 }, // High income
    { limit: Infinity, factor: 0.40, deduction: 2539080 }
];

export function calculateSalary(grossSalary, contractType = 'indefinido') {
    const gross = Math.max(0, Number(grossSalary));
    
    // 1. Social Security Deductions (Leyes Sociales)
    // Apply "Tope Imponible" logic if needed, for now simple %
    
    const afp = Math.round(gross * CONSTANTS.AFP_RATE);
    const health = Math.round(gross * CONSTANTS.HEALTH_RATE);
    
    let unemploymentRate = contractType === 'indefinido' 
        ? CONSTANTS.UNEMPLOYMENT_INDEFINITE 
        : CONSTANTS.UNEMPLOYMENT_FIXED;
        
    const unemployment = Math.round(gross * unemploymentRate);
    
    const totalSocialDeductions = afp + health + unemployment;
    
    // 2. Taxable Income (Tributable)
    const taxableIncome = gross - totalSocialDeductions;
    
    // 3. Income Tax (Impuesto Único)
    let tax = 0;
    if (taxableIncome > 0) {
        for (const bracket of TAX_BRACKETS) {
            if (taxableIncome <= bracket.limit) {
                tax = (taxableIncome * bracket.factor) - bracket.deduction;
                break;
            }
            // If it's the last bracket (Infinity)
            if (bracket.limit === Infinity) {
                tax = (taxableIncome * bracket.factor) - bracket.deduction;
            }
        }
    }
    tax = Math.max(0, Math.round(tax));
    
    // 4. Liquid Salary
    const liquid = taxableIncome - tax;
    
    return {
        gross,
        afp,
        health,
        unemployment,
        tax,
        liquid
    };
}

export function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0
    }).format(amount);
}
