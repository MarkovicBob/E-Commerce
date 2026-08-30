"""Payment abstraction.

Only a mock provider is wired up. Everything the app calls goes through the
`PaymentProvider` protocol, so swapping in Stripe means writing one class and
rebinding `payment_provider` — no caller changes.
"""

import logging
from typing import Protocol

logger = logging.getLogger(__name__)

SUPPORTED_METHODS = {"card", "cash_on_delivery"}


class PaymentError(Exception):
    """Raised when a charge cannot be taken; the router turns this into a 400."""


class PaymentResult:
    def __init__(self, reference: str, amount: float, method: str) -> None:
        self.reference = reference
        self.amount = amount
        self.method = method


class PaymentProvider(Protocol):
    def charge(self, amount: float, method: str) -> PaymentResult:
        ...


class MockPaymentProvider:
    """Always succeeds for a valid method and a non-negative amount."""

    def charge(self, amount: float, method: str) -> PaymentResult:
        if method not in SUPPORTED_METHODS:
            raise PaymentError("Unsupported payment method")
        if amount < 0:
            raise PaymentError("Invalid payment amount")
        # Never log card data — there is none here, and there should never be.
        logger.info("Mock charge accepted: %.2f via %s", amount, method)
        return PaymentResult(reference=f"MOCK-{method.upper()}", amount=amount, method=method)


payment_provider: PaymentProvider = MockPaymentProvider()
