// Sample catalog: 48 fictional products from fictional brands, written for this prototype.
// No real merchant, advertiser, or employer data.

const CATEGORIES = {
  running_shoes: { label: "Running shoes", icon: "shoe" },
  espresso_machines: { label: "Espresso machines", icon: "espresso" },
  headphones: { label: "Headphones", icon: "headphones" },
};

// Controlled attribute vocabulary per category. The LLM maps vague shopper language
// onto these tags; retrieval and the ad auction only ever see tags.
const VOCAB = {
  running_shoes: {
    "stability": "Stability / arch support (flat feet, overpronation)",
    "neutral": "Neutral support",
    "max-cushion": "Max cushioning (long runs, joint comfort)",
    "lightweight": "Lightweight",
    "wide-toe-box": "Wide toe box (wide feet)",
    "trail": "Trail grip",
    "waterproof": "Waterproof",
    "carbon-plate": "Carbon plate (racing)",
    "beginner-friendly": "Beginner friendly",
    "durable": "Durable / high mileage",
  },
  espresso_machines: {
    "compact": "Compact footprint",
    "quiet": "Quiet operation",
    "milk-frother": "Milk frother / steam wand",
    "built-in-grinder": "Built-in grinder",
    "beginner-friendly": "Beginner friendly",
    "manual-lever": "Manual lever",
    "pod-compatible": "Uses pods / capsules",
    "fast-heatup": "Fast heat-up",
    "dual-boiler": "Dual boiler",
    "easy-clean": "Easy to clean",
  },
  headphones: {
    "noise-cancelling": "Active noise cancelling",
    "over-ear": "Over-ear",
    "earbuds": "Earbuds",
    "long-battery": "Long battery life",
    "sweatproof": "Sweatproof",
    "secure-fit": "Secure fit (stays in)",
    "lightweight": "Lightweight",
    "multipoint": "Multipoint (two devices)",
    "call-quality": "Clear call mic",
    "low-latency": "Low latency (gaming)",
    "foldable": "Foldable",
    "wired-option": "Wired option",
  },
};

const ATTR_SHORT = {
  "stability": "Stability", "neutral": "Neutral", "max-cushion": "Max cushion", "lightweight": "Lightweight",
  "wide-toe-box": "Wide toe box", "trail": "Trail", "waterproof": "Waterproof", "carbon-plate": "Carbon plate",
  "beginner-friendly": "Beginner friendly", "durable": "Durable", "compact": "Compact", "quiet": "Quiet",
  "milk-frother": "Milk frother", "built-in-grinder": "Built-in grinder", "manual-lever": "Manual lever",
  "pod-compatible": "Pods", "fast-heatup": "Fast heat-up", "dual-boiler": "Dual boiler", "easy-clean": "Easy clean",
  "noise-cancelling": "Noise cancelling", "over-ear": "Over-ear", "earbuds": "Earbuds", "long-battery": "Long battery",
  "sweatproof": "Sweatproof", "secure-fit": "Secure fit", "multipoint": "Multipoint", "call-quality": "Call mic",
  "low-latency": "Low latency", "foldable": "Foldable", "wired-option": "Wired option",
};

const CATALOG = [
  // Running shoes
  { id: "rs01", cat: "running_shoes", brand: "Stridewell", name: "Glide 5", price: 130, rating: 4.6, reviews: 2140, attrs: ["neutral", "max-cushion", "durable"], spec: "10.1 oz · 10 mm drop" },
  { id: "rs02", cat: "running_shoes", brand: "Stridewell", name: "Anchor 3", price: 115, rating: 4.5, reviews: 1320, attrs: ["stability", "wide-toe-box", "beginner-friendly", "durable"], spec: "10.6 oz · 12 mm drop" },
  { id: "rs03", cat: "running_shoes", brand: "Pacegrid", name: "Volt Elite", price: 250, rating: 4.4, reviews: 610, attrs: ["carbon-plate", "lightweight", "neutral"], spec: "7.2 oz · 8 mm drop" },
  { id: "rs04", cat: "running_shoes", brand: "Pacegrid", name: "Tempo Trainer", price: 140, rating: 4.3, reviews: 880, attrs: ["lightweight", "neutral"], spec: "8.4 oz · 8 mm drop" },
  { id: "rs05", cat: "running_shoes", brand: "Pacegrid", name: "Steady GT", price: 125, rating: 4.4, reviews: 970, attrs: ["stability", "max-cushion"], spec: "10.9 oz · 10 mm drop" },
  { id: "rs06", cat: "running_shoes", brand: "Terrafoot", name: "Ridge GTX", price: 160, rating: 4.6, reviews: 740, attrs: ["trail", "waterproof", "durable"], spec: "11.4 oz · 6 mm drop" },
  { id: "rs07", cat: "running_shoes", brand: "Terrafoot", name: "Scree 2", price: 120, rating: 4.2, reviews: 450, attrs: ["trail", "lightweight"], spec: "9.0 oz · 4 mm drop" },
  { id: "rs08", cat: "running_shoes", brand: "Terrafoot", name: "Mudline WP", price: 105, rating: 4.1, reviews: 390, attrs: ["trail", "waterproof", "beginner-friendly"], spec: "11.0 oz · 8 mm drop" },
  { id: "rs09", cat: "running_shoes", brand: "Loma Run", name: "Cloudbank", price: 150, rating: 4.7, reviews: 1880, attrs: ["max-cushion", "neutral", "wide-toe-box"], spec: "9.8 oz · 5 mm drop" },
  { id: "rs10", cat: "running_shoes", brand: "Loma Run", name: "Daily", price: 85, rating: 4.2, reviews: 2600, attrs: ["neutral", "beginner-friendly", "lightweight"], spec: "8.9 oz · 8 mm drop" },
  { id: "rs11", cat: "running_shoes", brand: "Loma Run", name: "Brace", price: 110, rating: 4.3, reviews: 1150, attrs: ["stability", "beginner-friendly"], spec: "10.4 oz · 10 mm drop" },
  { id: "rs12", cat: "running_shoes", brand: "Kestrel Athletic", name: "Sprint Carbon", price: 210, rating: 4.5, reviews: 520, attrs: ["carbon-plate", "lightweight"], spec: "7.0 oz · 6 mm drop" },
  { id: "rs13", cat: "running_shoes", brand: "Kestrel Athletic", name: "Roomy Trainer", price: 95, rating: 4.4, reviews: 1010, attrs: ["wide-toe-box", "neutral", "beginner-friendly"], spec: "9.6 oz · 8 mm drop" },
  { id: "rs14", cat: "running_shoes", brand: "Kestrel Athletic", name: "Guide Max", price: 145, rating: 4.6, reviews: 830, attrs: ["stability", "max-cushion", "wide-toe-box"], spec: "11.2 oz · 8 mm drop" },
  { id: "rs15", cat: "running_shoes", brand: "Stridewell", name: "Breeze Lite", price: 100, rating: 4.0, reviews: 700, attrs: ["lightweight", "neutral"], spec: "8.1 oz · 6 mm drop" },
  { id: "rs16", cat: "running_shoes", brand: "Pacegrid", name: "Stormproof", price: 135, rating: 4.1, reviews: 300, attrs: ["waterproof", "neutral", "durable"], spec: "10.8 oz · 10 mm drop" },

  // Espresso machines
  { id: "es01", cat: "espresso_machines", brand: "Brewlo", name: "Mini", price: 249, rating: 4.5, reviews: 1600, attrs: ["compact", "quiet", "beginner-friendly", "fast-heatup"], spec: '6.1" wide · 52 dB' },
  { id: "es02", cat: "espresso_machines", brand: "Brewlo", name: "Barista Pro", price: 599, rating: 4.6, reviews: 900, attrs: ["built-in-grinder", "milk-frother", "dual-boiler"], spec: '13.5" wide · 68 dB' },
  { id: "es03", cat: "espresso_machines", brand: "Brewlo", name: "Pod One", price: 129, rating: 4.2, reviews: 3100, attrs: ["pod-compatible", "compact", "fast-heatup", "easy-clean"], spec: '5.5" wide · 60 dB' },
  { id: "es04", cat: "espresso_machines", brand: "Kettlebrook", name: "S2", price: 279, rating: 4.4, reviews: 1200, attrs: ["compact", "milk-frother", "easy-clean"], spec: '7.8" wide · 63 dB' },
  { id: "es05", cat: "espresso_machines", brand: "Kettlebrook", name: "Grind & Go", price: 449, rating: 4.3, reviews: 760, attrs: ["built-in-grinder", "milk-frother", "beginner-friendly"], spec: '12.2" wide · 70 dB' },
  { id: "es06", cat: "espresso_machines", brand: "Kettlebrook", name: "Whisper", price: 329, rating: 4.6, reviews: 540, attrs: ["quiet", "milk-frother", "compact"], spec: '8.0" wide · 49 dB' },
  { id: "es07", cat: "espresso_machines", brand: "Ardena", name: "One", price: 229, rating: 4.3, reviews: 980, attrs: ["quiet", "easy-clean", "beginner-friendly"], spec: '9.4" wide · 51 dB' },
  { id: "es08", cat: "espresso_machines", brand: "Ardena", name: "Lever Classic", price: 389, rating: 4.5, reviews: 310, attrs: ["manual-lever", "compact"], spec: '7.0" wide · 45 dB' },
  { id: "es09", cat: "espresso_machines", brand: "Ardena", name: "Duo", price: 899, rating: 4.8, reviews: 220, attrs: ["dual-boiler", "milk-frother", "quiet"], spec: '14.0" wide · 50 dB' },
  { id: "es10", cat: "espresso_machines", brand: "Mokalab", name: "Starter", price: 159, rating: 4.1, reviews: 2050, attrs: ["beginner-friendly", "milk-frother", "easy-clean"], spec: '8.6" wide · 64 dB' },
  { id: "es11", cat: "espresso_machines", brand: "Mokalab", name: "Capsule Plus", price: 179, rating: 4.0, reviews: 1700, attrs: ["pod-compatible", "milk-frother", "fast-heatup"], spec: '7.2" wide · 62 dB' },
  { id: "es12", cat: "espresso_machines", brand: "Mokalab", name: "Grinder Max", price: 529, rating: 4.4, reviews: 410, attrs: ["built-in-grinder", "dual-boiler"], spec: '13.0" wide · 71 dB' },
  { id: "es13", cat: "espresso_machines", brand: "Vellum Home", name: "Petite", price: 199, rating: 4.2, reviews: 650, attrs: ["compact", "quiet", "easy-clean"], spec: '6.4" wide · 53 dB' },
  { id: "es14", cat: "espresso_machines", brand: "Vellum Home", name: "Café", price: 289, rating: 4.1, reviews: 500, attrs: ["milk-frother", "built-in-grinder", "beginner-friendly"], spec: '11.0" wide · 69 dB' },
  { id: "es15", cat: "espresso_machines", brand: "Vellum Home", name: "Pod Duo", price: 99, rating: 3.9, reviews: 2200, attrs: ["pod-compatible", "compact"], spec: '5.8" wide · 61 dB' },
  { id: "es16", cat: "espresso_machines", brand: "Brewlo", name: "Steam Studio", price: 349, rating: 4.4, reviews: 880, attrs: ["milk-frother", "fast-heatup", "easy-clean"], spec: '10.2" wide · 65 dB' },

  // Headphones
  { id: "hp01", cat: "headphones", brand: "Quietform", name: "QX900", price: 349, rating: 4.7, reviews: 3400, attrs: ["noise-cancelling", "over-ear", "long-battery", "multipoint", "call-quality"], spec: "30 h battery · 250 g" },
  { id: "hp02", cat: "headphones", brand: "Quietform", name: "QX500", price: 199, rating: 4.5, reviews: 2100, attrs: ["noise-cancelling", "over-ear", "long-battery", "foldable"], spec: "40 h battery · 265 g" },
  { id: "hp03", cat: "headphones", brand: "Quietform", name: "Buds ANC", price: 179, rating: 4.3, reviews: 1900, attrs: ["noise-cancelling", "earbuds", "multipoint"], spec: "8 h battery · 5 g/bud" },
  { id: "hp04", cat: "headphones", brand: "Northtone", name: "Arc", price: 249, rating: 4.4, reviews: 1200, attrs: ["noise-cancelling", "over-ear", "lightweight", "call-quality", "multipoint"], spec: "24 h battery · 210 g" },
  { id: "hp05", cat: "headphones", brand: "Northtone", name: "Sprint Buds", price: 89, rating: 4.3, reviews: 2600, attrs: ["earbuds", "sweatproof", "secure-fit"], spec: "9 h battery · IPX5" },
  { id: "hp06", cat: "headphones", brand: "Northtone", name: "Studio Wired", price: 129, rating: 4.5, reviews: 700, attrs: ["over-ear", "wired-option", "low-latency"], spec: "Wired · 280 g" },
  { id: "hp07", cat: "headphones", brand: "Wavelet", name: "Aero", price: 149, rating: 4.2, reviews: 880, attrs: ["noise-cancelling", "over-ear", "lightweight", "foldable", "long-battery"], spec: "35 h battery · 198 g" },
  { id: "hp08", cat: "headphones", brand: "Wavelet", name: "Game Pro", price: 159, rating: 4.4, reviews: 1400, attrs: ["over-ear", "low-latency", "wired-option"], spec: "20 h battery · 310 g" },
  { id: "hp09", cat: "headphones", brand: "Wavelet", name: "Buds Lite", price: 39, rating: 3.8, reviews: 5200, attrs: ["earbuds", "lightweight"], spec: "6 h battery · 4 g/bud" },
  { id: "hp10", cat: "headphones", brand: "Pulsebay", name: "Fit", price: 69, rating: 4.1, reviews: 3000, attrs: ["earbuds", "sweatproof", "secure-fit", "long-battery"], spec: "12 h battery · IPX7" },
  { id: "hp11", cat: "headphones", brand: "Pulsebay", name: "Commuter", price: 119, rating: 4.0, reviews: 1500, attrs: ["noise-cancelling", "earbuds", "call-quality"], spec: "7 h battery · 5 g/bud" },
  { id: "hp12", cat: "headphones", brand: "Pulsebay", name: "Max", price: 299, rating: 4.3, reviews: 640, attrs: ["noise-cancelling", "over-ear", "long-battery", "multipoint"], spec: "45 h battery · 290 g" },
  { id: "hp13", cat: "headphones", brand: "Halcyon Audio", name: "Office", price: 139, rating: 4.4, reviews: 900, attrs: ["over-ear", "multipoint", "call-quality", "long-battery"], spec: "50 h battery · 230 g" },
  { id: "hp14", cat: "headphones", brand: "Halcyon Audio", name: "Air", price: 99, rating: 4.0, reviews: 1300, attrs: ["noise-cancelling", "earbuds", "lightweight"], spec: "6 h battery · 4 g/bud" },
  { id: "hp15", cat: "headphones", brand: "Halcyon Audio", name: "Arena", price: 189, rating: 4.2, reviews: 420, attrs: ["earbuds", "low-latency"], spec: "8 h battery · 2.4 GHz dongle" },
  { id: "hp16", cat: "headphones", brand: "Wavelet", name: "Basics", price: 45, rating: 3.9, reviews: 2900, attrs: ["over-ear", "foldable", "wired-option"], spec: "Wired · 180 g" },
];

// Sponsored campaigns: one promoted product each, with a max CPC bid in USD.
const CAMPAIGNS = [
  { id: "c01", advertiser: "Pacegrid", productId: "rs03", bid: 2.40 },
  { id: "c02", advertiser: "Pacegrid", productId: "rs05", bid: 1.60 },
  { id: "c03", advertiser: "Stridewell", productId: "rs02", bid: 1.10 },
  { id: "c04", advertiser: "Terrafoot", productId: "rs06", bid: 1.30 },
  { id: "c05", advertiser: "Kestrel Athletic", productId: "rs14", bid: 1.40 },
  { id: "c06", advertiser: "Loma Run", productId: "rs10", bid: 0.90 },
  { id: "c07", advertiser: "Brewlo", productId: "es02", bid: 2.20 },
  { id: "c08", advertiser: "Brewlo", productId: "es01", bid: 1.20 },
  { id: "c09", advertiser: "Kettlebrook", productId: "es06", bid: 1.50 },
  { id: "c10", advertiser: "Mokalab", productId: "es11", bid: 1.00 },
  { id: "c11", advertiser: "Vellum Home", productId: "es13", bid: 0.80 },
  { id: "c12", advertiser: "Quietform", productId: "hp01", bid: 2.00 },
  { id: "c13", advertiser: "Pulsebay", productId: "hp10", bid: 0.95 },
  { id: "c14", advertiser: "Wavelet", productId: "hp08", bid: 1.10 },
  { id: "c15", advertiser: "Halcyon Audio", productId: "hp13", bid: 1.20 },
  { id: "c16", advertiser: "Northtone", productId: "hp04", bid: 1.40 },
];

const PRODUCT_BY_ID = Object.fromEntries(CATALOG.map((p) => [p.id, p]));
const fullName = (p) => `${p.brand} ${p.name}`;
