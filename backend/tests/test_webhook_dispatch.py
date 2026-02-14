# ruff: noqa: INP001
"""Webhook queue helper unit tests."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from app.services.webhooks.queue import (
    QueuedWebhookDelivery,
    dequeue_webhook_delivery,
    enqueue_webhook_delivery,
    requeue_if_failed,
)


class _FakeRedis:
    def __init__(self) -> None:
        self.values: list[str] = []

    def lpush(self, key: str, value: str) -> None:
        self.values.insert(0, value)

    def rpop(self, key: str) -> str | None:
        if not self.values:
            return None
        return self.values.pop()


@pytest.mark.parametrize("attempts", [0, 1, 2])
def test_webhook_queue_roundtrip(monkeypatch: pytest.MonkeyPatch, attempts: int) -> None:
    fake = _FakeRedis()

    def _fake_redis() -> _FakeRedis:
        return fake

    board_id = uuid4()
    webhook_id = uuid4()
    payload_id = uuid4()
    payload = QueuedWebhookDelivery(
        board_id=board_id,
        webhook_id=webhook_id,
        payload_id=payload_id,
        payload_event="push",
        received_at=datetime.now(UTC),
        attempts=attempts,
    )

    monkeypatch.setattr("app.services.webhooks.queue._redis_client", _fake_redis)
    assert enqueue_webhook_delivery(payload)

    dequeued = dequeue_webhook_delivery()
    assert dequeued is not None
    assert dequeued.board_id == board_id
    assert dequeued.webhook_id == webhook_id
    assert dequeued.payload_id == payload_id
    assert dequeued.payload_event == "push"
    assert dequeued.attempts == attempts


@pytest.mark.parametrize("attempts", [0, 1, 2, 3])
def test_requeue_respects_retry_cap(monkeypatch: pytest.MonkeyPatch, attempts: int) -> None:
    fake = _FakeRedis()

    def _fake_redis() -> _FakeRedis:
        return fake

    monkeypatch.setattr("app.services.webhooks.queue._redis_client", _fake_redis)

    payload = QueuedWebhookDelivery(
        board_id=uuid4(),
        webhook_id=uuid4(),
        payload_id=uuid4(),
        payload_event="push",
        received_at=datetime.now(UTC),
        attempts=attempts,
    )

    if attempts >= 3:
        assert requeue_if_failed(payload) is False
        assert fake.values == []
    else:
        assert requeue_if_failed(payload) is True
        requeued = dequeue_webhook_delivery()
        assert requeued is not None
        assert requeued.attempts == attempts + 1
