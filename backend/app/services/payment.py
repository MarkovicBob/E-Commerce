from typing import Protocol


class PaymentProvider(Protocol):
    def charge(self, amount: float, method: str) -> bool:
        ...


class MockPaymentProvider:
    def charge(self, amount: float, method: str) -> bool:
        return method in {"card", "cash_on_delivery"} and amount >= 0


payment_provider: PaymentProvider = MockPaymentProvider()
