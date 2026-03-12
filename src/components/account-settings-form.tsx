"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
import { toast } from "sonner";
import {
  updateAccountPasswordAction,
  updateAccountProfileAction
} from "@/lib/actions/auth";

type AccountSettingsFormProps = {
  email: string;
  name: string;
};

export function AccountSettingsForm({ email, name }: AccountSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [profileName, setProfileName] = useState(name);
  const [profileEmail, setProfileEmail] = useState(email);
  const [profilePassword, setProfilePassword] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  return (
    <div className="space-y-4">
      <Card className="panel rounded-2xl">
        <CardHeader>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Account</p>
            <h2 className="text-lg font-semibold">Profile</h2>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <Input
            label="Name"
            value={profileName}
            onValueChange={setProfileName}
          />
          <Input
            label="Email"
            type="email"
            value={profileEmail}
            onValueChange={setProfileEmail}
          />
          <Input
            label="Current Password"
            type="password"
            value={profilePassword}
            onValueChange={setProfilePassword}
          />
          <Button
            color="primary"
            isDisabled={
              profileName.trim().length < 1 ||
              profileEmail.trim().length < 5 ||
              profilePassword.length < 1
            }
            isLoading={isPending}
            onPress={() => {
              startTransition(async () => {
                const result = await updateAccountProfileAction({
                  name: profileName,
                  email: profileEmail,
                  currentPassword: profilePassword
                });
                if (!result.success) {
                  toast.error(result.error);
                  return;
                }
                setProfilePassword("");
                toast.success("Profile updated");
              });
            }}
          >
            Save Profile
          </Button>
        </CardBody>
      </Card>

      <Card className="panel rounded-2xl">
        <CardHeader>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Security</p>
            <h2 className="text-lg font-semibold">Change Password</h2>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onValueChange={setCurrentPassword}
          />
          <Input
            description="At least 12 chars with uppercase, lowercase, number, and symbol."
            label="New Password"
            type="password"
            value={newPassword}
            onValueChange={setNewPassword}
          />
          <Button
            color="primary"
            isDisabled={currentPassword.length < 1 || newPassword.length < 1}
            isLoading={isPending}
            onPress={() => {
              startTransition(async () => {
                const result = await updateAccountPasswordAction({
                  currentPassword,
                  newPassword
                });
                if (!result.success) {
                  toast.error(result.error);
                  return;
                }
                setCurrentPassword("");
                setNewPassword("");
                toast.success("Password updated");
              });
            }}
          >
            Update Password
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

