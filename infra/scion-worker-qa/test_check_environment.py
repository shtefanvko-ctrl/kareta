"""Offline negative-path tests for the Scion GHCR environment publish gate."""
import copy
import unittest

from check_environment import EnvironmentNotReady, validate

ENV = {
    "name": "scion-qa-ghcr-approval",
    "can_admins_bypass": False,
    "deployment_branch_policy": {"protected_branches": False, "custom_branch_policies": True},
    "protection_rules": [
        {"type": "branch_policy"},
        {"type": "required_reviewers", "prevent_self_review": True, "reviewers": [
            {"type": "User", "reviewer": {"login": "qa-colleague", "id": 2399}},
        ]},
    ],
}
POLICY = {"total_count": 1, "branch_policies": [{"name": "main", "type": "branch"}]}


class EnvironmentGateTests(unittest.TestCase):
    def deny(self, environment=ENV, branch_policies=POLICY):
        with self.assertRaises(EnvironmentNotReady):
            validate(environment, branch_policies)

    def test_valid_independent_review_and_main_only(self):
        validate(copy.deepcopy(ENV), copy.deepcopy(POLICY))

    def test_no_reviewers_is_denied(self):
        value = copy.deepcopy(ENV)
        value["protection_rules"] = [{"type": "branch_policy"}]
        self.deny(value)

    def test_only_owner_reviewer_denied(self):
        value = copy.deepcopy(ENV)
        value["protection_rules"][1]["reviewers"][0]["reviewer"]["login"] = "shtefanvko-ctrl"
        self.deny(value)

    def test_no_prevent_self_review_denied(self):
        value = copy.deepcopy(ENV)
        value["protection_rules"][1]["prevent_self_review"] = False
        self.deny(value)

    def test_admin_bypass_allowed_denied(self):
        value = copy.deepcopy(ENV)
        value["can_admins_bypass"] = True
        self.deny(value)

    def test_admin_bypass_unknown_denied(self):
        value = copy.deepcopy(ENV)
        value["can_admins_bypass"] = None
        self.deny(value)

    def test_branch_policy_restriction_missing_denied(self):
        value = copy.deepcopy(ENV)
        value["deployment_branch_policy"] = {"protected_branches": True, "custom_branch_policies": False}
        self.deny(value)

    def test_multiple_deployment_branches_denied(self):
        value = copy.deepcopy(POLICY)
        value["total_count"] = 2
        value["branch_policies"].append({"name": "develop", "type": "branch"})
        self.deny(ENV, value)

    def test_wrong_branch_denied(self):
        value = copy.deepcopy(POLICY)
        value["branch_policies"][0]["name"] = "release/*"
        self.deny(ENV, value)

    def test_environment_missing_denied(self):
        value = copy.deepcopy(ENV)
        value["name"] = "production"
        self.deny(value)

    def test_review_rule_incorrect_shape_denied(self):
        value = copy.deepcopy(ENV)
        value["protection_rules"][1]["reviewers"] = ["qa-colleague"]
        self.deny(value)

    def test_unauthorized_team_reviewer_alone_denied(self):
        value = copy.deepcopy(ENV)
        value["protection_rules"][1]["reviewers"] = [
            {"type": "Team", "reviewer": {"slug": "admins", "id": 123}}]
        self.deny(value)


if __name__ == "__main__":
    unittest.main()
