const TAX_RATES = {
  'US-CA': { rate: 0.0950, name: 'California State & Local Sales Tax' },
  'US-NY': { rate: 0.08875, name: 'New York City Composite Tax' },
  'US-TX': { rate: 0.0825, name: 'Texas Sales and Use Tax' },
  'US-WA': { rate: 0.1025, name: 'Washington State & Municipal Tax' },
  'EU-DE': { rate: 0.1900, name: 'Germany Standard Mehrwertsteuer (MwSt)' },
  'EU-FR': { rate: 0.2000, name: 'France Taxe sur la valeur ajoutée (TVA)' },
  'UK':    { rate: 0.2000, name: 'UK Standard Value Added Tax (VAT)' },
  'IN-KA': { rate: 0.1800, name: 'India Karnataka Goods & Services Tax (GST)' },
  'IN-MH': { rate: 0.1800, name: 'India Maharashtra Goods & Services Tax (GST)' },
  'DEFAULT': { rate: 0.0500, name: 'Standard Baseline Regional Tax' }
};

class TaxEngine {
  static getSupportedJurisdictions() {
    return Object.keys(TAX_RATES).map(code => ({
      code,
      name: TAX_RATES[code].name,
      percentage: (TAX_RATES[code].rate * 100).toFixed(2) + '%'
    }));
  }

  static calculateTax(subtotal, locationCode = 'DEFAULT') {
    const locStr = typeof locationCode === 'string' ? locationCode : (locationCode?.code || 'DEFAULT');
    const normCode = String(locStr || 'DEFAULT').toUpperCase().trim();
    const config = TAX_RATES[normCode] || TAX_RATES['DEFAULT'];
    
    const taxableSubtotal = Math.max(0, Number(subtotal) || 0);
    const taxAmount = Number((taxableSubtotal * config.rate).toFixed(2));
    const totalAmount = Number((taxableSubtotal + taxAmount).toFixed(2));

    return {
      jurisdiction: normCode,
      taxRule: config.name,
      taxRate: config.rate,
      taxRatePercentage: (config.rate * 100).toFixed(2) + '%',
      subtotal: Number(taxableSubtotal.toFixed(2)),
      taxAmount,
      totalAmount
    };
  }
}

module.exports = TaxEngine;
