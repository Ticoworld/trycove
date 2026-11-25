export function displayOpportunityText(value: string) {
  return value.replace(/^\s*[-*]\s+/, '').replace(/\*\*([^*]+)\*\*/g, '$1');
}
