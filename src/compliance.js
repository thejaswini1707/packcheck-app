export function analyzeProduct(product,rules){
 const issues=[],checks=[];
 for(const rule of rules){let passed=true;const value=product[rule.field];if(rule.operator==='gt')passed=Number(value)>Number(rule.threshold);if(rule.operator==='not_empty')passed=value!==undefined&&value!==null&&String(value).trim()!=='';checks.push({ruleId:rule.id,key:rule.key,label:rule.label,passed,severity:rule.severity});if(!passed)issues.push({ruleId:rule.id,ruleKey:rule.key,severity:rule.severity,message:rule.label})}
 const score=checks.length?Math.round(checks.filter(c=>c.passed).length/checks.length*100):100;return{status:issues.length?'Non-Compliant':'Compliant',score,complianceScore:score,riskScore:100-score,issues,checks};
}
