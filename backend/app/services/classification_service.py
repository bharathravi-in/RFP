"""
Question Classification Service

Classifies RFP questions into categories using keyword matching
and AI-powered classification for complex cases.
"""
import re
import logging
from typing import Dict, List, Optional
from flask import current_app

logger = logging.getLogger(__name__)


class ClassificationService:
    """Service for classifying RFP questions and knowledge items."""
    
    # Main categories with their keywords and sub-categories
    CATEGORIES = {
        'security': {
            'keywords': [
                'encrypt', 'security', 'authentication', 'authorization',
                'access control', 'password', 'mfa', 'two-factor', '2fa',
                'firewall', 'vulnerability', 'penetration', 'intrusion',
                'threat', 'malware', 'virus', 'ransomware', 'ddos',
                'secure', 'protection', 'breach', 'incident', 'siem'
            ],
            'sub_categories': {
                'encryption': ['encrypt', 'aes', 'tls', 'ssl', 'rsa', 'key management'],
                'access_control': ['access control', 'rbac', 'permissions', 'authorization', 'least privilege'],
                'authentication': ['authentication', 'mfa', 'sso', 'saml', 'oauth', 'password', 'login'],
                'incident_response': ['incident', 'breach', 'response', 'recovery', 'forensic'],
                'network_security': ['firewall', 'vpn', 'network', 'ddos', 'intrusion'],
                'vulnerability_management': ['vulnerability', 'penetration', 'scan', 'patch', 'cve']
            }
        },
        'compliance': {
            'keywords': [
                'soc 2', 'soc2', 'iso 27001', 'iso27001', 'gdpr', 'hipaa',
                'pci', 'pci-dss', 'fedramp', 'compliance', 'compliant',
                'audit', 'certification', 'certified', 'regulation',
                'regulatory', 'privacy', 'data protection', 'ccpa',
                'attestation', 'framework', 'nist', 'cis'
            ],
            'sub_categories': {
                'soc2': ['soc 2', 'soc2', 'type ii', 'type 2', 'aicpa'],
                'iso27001': ['iso 27001', 'iso27001', 'isms'],
                'gdpr': ['gdpr', 'data protection', 'eu privacy', 'right to be forgotten', 'dpo'],
                'hipaa': ['hipaa', 'phi', 'healthcare', 'baa'],
                'pci_dss': ['pci', 'pci-dss', 'payment card', 'cardholder'],
                'privacy': ['privacy', 'ccpa', 'personal data', 'consent']
            }
        },
        'technical': {
            'keywords': [
                'api', 'integration', 'architecture', 'infrastructure',
                'database', 'performance', 'scalability', 'uptime', 'sla',
                'deployment', 'backup', 'disaster recovery', 'redundancy',
                'latency', 'availability', 'capacity', 'load', 'cloud',
                'aws', 'azure', 'gcp', 'kubernetes', 'docker', 'microservice'
            ],
            'sub_categories': {
                'api': ['api', 'rest', 'graphql', 'webhook', 'endpoint', 'sdk'],
                'infrastructure': ['infrastructure', 'cloud', 'aws', 'azure', 'gcp', 'data center'],
                'architecture': ['architecture', 'microservice', 'design', 'scalability'],
                'performance': ['performance', 'latency', 'throughput', 'response time'],
                'availability': ['uptime', 'sla', 'availability', 'redundancy', 'failover'],
                'data': ['database', 'backup', 'recovery', 'retention', 'storage']
            }
        },
        'pricing': {
            'keywords': [
                'cost', 'price', 'pricing', 'fee', 'license', 'licensing',
                'subscription', 'payment', 'discount', 'quote', 'budget',
                'invoice', 'billing', 'charge', 'rate', 'tier', 'plan',
                'annual', 'monthly', 'per user', 'per seat'
            ],
            'sub_categories': {
                'licensing': ['license', 'licensing', 'seat', 'user', 'subscription'],
                'billing': ['billing', 'invoice', 'payment', 'charge'],
                'discounts': ['discount', 'volume', 'enterprise', 'negotiable'],
                'structure': ['pricing', 'tier', 'plan', 'package']
            }
        },
        'legal': {
            'keywords': [
                'contract', 'liability', 'indemnification', 'indemnify',
                'warranty', 'termination', 'intellectual property', 'ip',
                'confidential', 'nda', 'agreement', 'terms', 'conditions',
                'clause', 'obligation', 'jurisdiction', 'governing law',
                'dispute', 'arbitration', 'limitation', 'damages'
            ],
            'sub_categories': {
                'contract': ['contract', 'agreement', 'terms', 'conditions'],
                'liability': ['liability', 'limitation', 'damages', 'indemnification'],
                'ip': ['intellectual property', 'ip', 'patent', 'copyright', 'trademark'],
                'confidentiality': ['confidential', 'nda', 'non-disclosure'],
                'termination': ['termination', 'cancel', 'exit', 'renewal']
            }
        },
        'product': {
            'keywords': [
                'feature', 'functionality', 'roadmap', 'release', 'version',
                'support', 'training', 'implementation', 'onboarding',
                'customization', 'configuration', 'capability', 'module',
                'workflow', 'dashboard', 'report', 'analytics', 'user interface',
                'mobile', 'desktop', 'browser'
            ],
            'sub_categories': {
                'features': ['feature', 'functionality', 'capability', 'module'],
                'support': ['support', 'help desk', 'sla', 'response time'],
                'implementation': ['implementation', 'onboarding', 'deployment', 'migration'],
                'training': ['training', 'documentation', 'user guide', 'certification'],
                'roadmap': ['roadmap', 'release', 'version', 'future']
            }
        }
    }
    
    # Sensitive question patterns that should be flagged
    SENSITIVE_PATTERNS = [
        r'liability',
        r'indemnif',
        r'damages',
        r'unlimited',
        r'guarantee',
        r'warrant',
        r'breach notification',
        r'data breach',
        r'penalty',
        r'fine',
        r'legal action'
    ]

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.ai_enabled = False
        self.model = None
        self._llm_provider = None

    def _init_ai(self) -> bool:
        """Initialize AI model for complex classification."""
        # Try dynamic LLM provider first
        if self.org_id:
            try:
                from app.services.llm_service_helper import get_llm_provider
                self._llm_provider = get_llm_provider(self.org_id, 'classification')
                if self._llm_provider:
                    self.ai_enabled = True
                    logger.info(f"Classification using dynamic provider: {self._llm_provider.provider_name}")
                    return True
            except Exception as e:
                logger.warning(f"Could not load dynamic LLM: {e}")
        
        # Fallback to legacy Google
        try:
            api_key = current_app.config.get('GOOGLE_API_KEY')
            if api_key:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel('gemini-1.5-flash')
                self.ai_enabled = True
                logger.info("Classification using legacy Google provider")
                return True
        except Exception as e:
            logger.warning(f"Legacy AI initialization failed: {e}")
        return False
    
    def _generate(self, prompt: str) -> str:
        """Generate content using configured provider."""
        if self._llm_provider:
            return self._llm_provider.generate_content(prompt)
        elif self.model:
            response = self.model.generate_content(prompt)
            return response.text
        else:
            raise RuntimeError("No AI provider available")

    def classify_question(self, question_text: str) -> Dict:
        """
        Classify a single question.
        
        Args:
            question_text: The question to classify
        
        Returns:
            Dict with:
            - category: Main category
            - sub_category: Specific sub-category
            - confidence: Confidence score (0.0 to 1.0)
            - flags: List of flags (sensitive, ambiguous, etc.)
        """
        # First try keyword-based classification (fast)
        result = self._keyword_classification(question_text)
        
        # Check for sensitive content
        result['flags'] = self._detect_flags(question_text)
        
        # If low confidence, try AI classification
        if result['confidence'] < 0.6 and (self.ai_enabled or self._init_ai()):
            ai_result = self._ai_classification(question_text)
            if ai_result and ai_result['confidence'] > result['confidence']:
                result.update(ai_result)
                result['flags'] = self._detect_flags(question_text)
        
        return result

    def classify_batch(self, questions: List[str]) -> List[Dict]:
        """
        Classify multiple questions efficiently.
        
        Uses batch AI classification for better consistency.
        """
        # First pass: keyword classification
        results = [self._keyword_classification(q) for q in questions]
        
        # Find low-confidence questions for AI re-classification
        low_confidence_indices = [
            i for i, r in enumerate(results) if r['confidence'] < 0.6
        ]
        
        if low_confidence_indices and (self.ai_enabled or self._init_ai()):
            low_conf_questions = [questions[i] for i in low_confidence_indices]
            ai_results = self._ai_batch_classification(low_conf_questions)
            
            for idx, ai_result in zip(low_confidence_indices, ai_results):
                if ai_result['confidence'] > results[idx]['confidence']:
                    results[idx].update(ai_result)
        
        # Add flags to all results
        for i, result in enumerate(results):
            result['flags'] = self._detect_flags(questions[i])
        
        return results

    def _keyword_classification(self, text: str) -> Dict:
        """Fast keyword-based classification."""
        text_lower = text.lower()
        scores = {}
        sub_category_matches = {}
        
        for category, data in self.CATEGORIES.items():
            # Count keyword matches
            matches = sum(1 for kw in data['keywords'] if kw in text_lower)
            
            if matches > 0:
                scores[category] = matches
                
                # Find best sub-category
                for sub_cat, sub_keywords in data.get('sub_categories', {}).items():
                    sub_matches = sum(1 for kw in sub_keywords if kw in text_lower)
                    if sub_matches > 0:
                        if category not in sub_category_matches:
                            sub_category_matches[category] = (sub_cat, sub_matches)
                        elif sub_matches > sub_category_matches[category][1]:
                            sub_category_matches[category] = (sub_cat, sub_matches)
        
        if not scores:
            return {
                'category': 'general',
                'sub_category': None,
                'confidence': 0.5
            }
        
        # Get best category
        best_category = max(scores, key=scores.get)
        
        # Calculate confidence (normalize by expected matches)
        max_expected = 5  # Expect at least 5 keyword matches for high confidence
        confidence = min(scores[best_category] / max_expected, 1.0)
        confidence = 0.4 + (confidence * 0.5)  # Scale to 0.4 - 0.9
        
        # Get sub-category if available
        sub_category = None
        if best_category in sub_category_matches:
            sub_category = sub_category_matches[best_category][0]
            confidence += 0.05  # Boost for having sub-category match
        
        return {
            'category': best_category,
            'sub_category': sub_category,
            'confidence': min(confidence, 0.95)
        }

    def _ai_classification(self, text: str) -> Optional[Dict]:
        """AI-powered classification for complex questions."""
        if not self._llm_provider and not self.model:
            return None
        
        categories_list = ', '.join(list(self.CATEGORIES.keys()) + ['general'])
        
        prompt = f"""Classify this RFP/questionnaire question into exactly ONE category.

Available categories: {categories_list}

Question: "{text}"

Respond in this EXACT format (no other text):
CATEGORY: [category name]
SUB_CATEGORY: [specific topic]
CONFIDENCE: [number between 0.5 and 1.0]"""

        try:
            response_text = self._generate(prompt)
            return self._parse_classification_response(response_text)
        except Exception as e:
            logger.error(f"AI classification failed: {e}")
            return None

    def _ai_batch_classification(self, questions: List[str]) -> List[Dict]:
        """Batch classification using AI."""
        if (not self._llm_provider and not self.model) or not questions:
            return [{'category': 'general', 'sub_category': None, 'confidence': 0.5}] * len(questions)
        
        categories_list = ', '.join(list(self.CATEGORIES.keys()) + ['general'])
        numbered = '\n'.join(f"{i+1}. {q[:200]}" for i, q in enumerate(questions))
        
        prompt = f"""Classify each RFP question into ONE category.

Categories: {categories_list}

Questions:
{numbered}

For EACH question, respond in this format:
[number]. CATEGORY: [category] | SUB: [sub-category] | CONF: [0.5-1.0]

Example:
1. CATEGORY: security | SUB: encryption | CONF: 0.9"""

        try:
            response_text = self._generate(prompt)
            return self._parse_batch_response(response_text, len(questions))
        except Exception as e:
            logger.error(f"Batch classification failed: {e}")
            return [self._keyword_classification(q) for q in questions]

    def _parse_classification_response(self, text: str) -> Optional[Dict]:
        """Parse single classification response."""
        try:
            category_match = re.search(r'CATEGORY:\s*(\w+)', text, re.I)
            sub_match = re.search(r'SUB_CATEGORY:\s*(\w+)', text, re.I)
            conf_match = re.search(r'CONFIDENCE:\s*([\d.]+)', text, re.I)
            
            if category_match:
                category = category_match.group(1).lower()
                # Validate category
                if category not in self.CATEGORIES and category != 'general':
                    category = 'general'
                
                return {
                    'category': category,
                    'sub_category': sub_match.group(1).lower() if sub_match else None,
                    'confidence': min(float(conf_match.group(1)), 1.0) if conf_match else 0.7
                }
        except Exception as e:
            logger.error(f"Failed to parse classification response: {e}")
        
        return None

    def _parse_batch_response(self, text: str, count: int) -> List[Dict]:
        """Parse batch classification response."""
        results = []
        
        for i in range(1, count + 1):
            pattern = rf'{i}\.\s*CATEGORY:\s*(\w+)\s*\|\s*SUB:\s*([^\|]+)\s*\|\s*CONF:\s*([\d.]+)'
            match = re.search(pattern, text, re.I)
            
            if match:
                category = match.group(1).lower()
                if category not in self.CATEGORIES and category != 'general':
                    category = 'general'
                
                results.append({
                    'category': category,
                    'sub_category': match.group(2).strip().lower() if match.group(2).strip() != '-' else None,
                    'confidence': min(float(match.group(3)), 1.0)
                })
            else:
                results.append({'category': 'general', 'sub_category': None, 'confidence': 0.5})
        
        return results

    def _detect_flags(self, text: str) -> List[str]:
        """Detect flags for the question."""
        flags = []
        text_lower = text.lower()
        
        # Check for sensitive content
        for pattern in self.SENSITIVE_PATTERNS:
            if re.search(pattern, text_lower):
                flags.append('sensitive')
                break
        
        # Check for legal review needed
        legal_keywords = ['liability', 'indemnif', 'warranty', 'damages', 'terminate']
        if any(kw in text_lower for kw in legal_keywords):
            flags.append('legal_review')
        
        return list(set(flags))

    def get_category_description(self, category: str) -> str:
        """Get a description for a category."""
        descriptions = {
            'security': 'Information security, access control, and data protection',
            'compliance': 'Regulatory compliance, certifications, and audits',
            'technical': 'Technical capabilities, architecture, and infrastructure',
            'pricing': 'Pricing, licensing, and commercial terms',
            'legal': 'Legal agreements, liability, and contractual matters',
            'product': 'Product features, support, and implementation',
            'general': 'General questions not fitting other categories'
        }
        return descriptions.get(category, 'Uncategorized question')


# Singleton instance (for backward compatibility)
classification_service = ClassificationService()


def get_classification_service(org_id: int = None) -> ClassificationService:
    """Get classification service instance with org-specific config."""
    if org_id:
        return ClassificationService(org_id=org_id)
    return classification_service
