# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import uuid

# Module imports
from .base import BaseSerializer
from rest_framework import serializers

from plane.db.models import State, StateGroup
from plane.db.models.state import STATE_REQUIRED_FIELD_KEYS, STATE_REQUIRED_TNA_PREFIX


class StateSerializer(BaseSerializer):
    order = serializers.FloatField(required=False)

    class Meta:
        model = State
        fields = [
            "id",
            "project_id",
            "workspace_id",
            "name",
            "color",
            "group",
            "default",
            "description",
            "sequence",
            "order",
            "required_fields",
        ]
        read_only_fields = ["workspace", "project"]

    @staticmethod
    def _is_valid_required_field(key):
        if key in STATE_REQUIRED_FIELD_KEYS:
            return True
        if isinstance(key, str) and key.startswith(STATE_REQUIRED_TNA_PREFIX):
            try:
                uuid.UUID(key[len(STATE_REQUIRED_TNA_PREFIX) :])
            except ValueError:
                return False
            return True
        return False

    def validate_required_fields(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("required_fields must be a list")
        invalid = [key for key in value if not self._is_valid_required_field(key)]
        if invalid:
            raise serializers.ValidationError(f"Unknown required fields: {', '.join(map(str, invalid))}")
        # drop duplicates, keep the order the admin picked them in
        return list(dict.fromkeys(value))

    def validate(self, attrs):
        if attrs.get("group") == StateGroup.TRIAGE.value:
            raise serializers.ValidationError("Cannot create triage state")
        return attrs


class StateLiteSerializer(BaseSerializer):
    class Meta:
        model = State
        fields = ["id", "name", "color", "group"]
        read_only_fields = fields
