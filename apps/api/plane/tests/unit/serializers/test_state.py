# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

import pytest
from rest_framework import serializers

from plane.app.serializers import StateSerializer
from plane.db.models.state import STATE_REQUIRED_FIELD_KEYS


@pytest.mark.unit
class TestStateRequiredFields:
    def test_accepts_known_keys_and_drops_duplicates(self):
        value = StateSerializer().validate_required_fields(["vendor", "category", "vendor"])
        assert value == ["vendor", "category"]

    def test_accepts_every_declared_key(self):
        assert StateSerializer().validate_required_fields(list(STATE_REQUIRED_FIELD_KEYS)) == STATE_REQUIRED_FIELD_KEYS

    def test_accepts_tna_target_keys_for_a_state_id(self):
        keys = [f"tna_target:{uuid.uuid4()}", "vendor"]
        assert StateSerializer().validate_required_fields(keys) == keys

    def test_rejects_malformed_tna_target_keys(self):
        with pytest.raises(serializers.ValidationError):
            StateSerializer().validate_required_fields(["tna_target:not-a-uuid"])

    def test_rejects_unknown_keys(self):
        with pytest.raises(serializers.ValidationError):
            StateSerializer().validate_required_fields(["vendor", "not_a_field"])

    def test_rejects_non_list(self):
        with pytest.raises(serializers.ValidationError):
            StateSerializer().validate_required_fields("vendor")
