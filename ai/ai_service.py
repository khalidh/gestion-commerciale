import json
from typing import Dict, List, Any


class CommercialAIAgent:
    """Minimal AI service scaffold for commercial use cases."""

    def __init__(self, provider: str = "mock") -> None:
        self.provider = provider

    def summarize_order(self, order: Dict[str, Any]) -> str:
        customer = order.get("customer", "client inconnu")
        amount = order.get("amount", 0)
        return f"Commande pour {customer} d'un montant de {amount} € à traiter avec priorité commerciale."

    def recommend_products(self, products: List[Dict[str, Any]], customer_context: str = "") -> List[Dict[str, Any]]:
        ranked = []
        for product in products:
            score = product.get("price", 0) / 100
            ranked.append({
                "name": product.get("name"),
                "price": product.get("price"),
                "score": round(score, 2),
                "reason": f"Produit pertinent pour {customer_context or 'un client standard'}"
            })
        return sorted(ranked, key=lambda item: item["score"], reverse=True)

    def build_dashboard_insights(self, metrics: Dict[str, Any]) -> List[str]:
        insights = []
        if metrics.get("sales_growth", 0) > 0:
            insights.append("La trajectoire des ventes est à la hausse.")
        else:
            insights.append("Le volume de ventes reste stable ou en légère baisse.")
        if metrics.get("payment_delay_days", 0) > 15:
            insights.append("Le délai moyen de paiement dépasse la norme attendue.")
        return insights


if __name__ == "__main__":
    agent = CommercialAIAgent()
    sample = {
        "customer": "Acme SA",
        "amount": 2500,
        "products": [{"name": "Pack Premium", "price": 1250}, {"name": "Abonnement Pro", "price": 320}]
    }
    payload = {
        "summary": agent.summarize_order(sample),
        "recommendations": agent.recommend_products(sample["products"], sample["customer"])
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
