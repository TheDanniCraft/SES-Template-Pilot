"use client";

import { useCallback, useState, useTransition } from "react";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteContactBookAction, saveContactBookAction } from "@/lib/actions/contact-books";
import type { ContactBook } from "@/lib/contact-books";
import { isValidContactEmail, normalizeRecipients } from "@/lib/contact-books";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { TagsInput } from "@/components/tags-input";

type ContactBooksManagerProps = {
  initialBooks: ContactBook[];
};

type ContactBookDraft = {
  localId: string;
  id: string;
  previousId: string | null;
  name: string;
  recipients: string[];
};

function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
  return "00000000-0000-4000-8000-000000000000";
}

function createContactBookId() {
  return createLocalId();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function toDraft(book: ContactBook): ContactBookDraft {
  const normalizedId = book.id.trim().toLowerCase();
  const keepId = isUuid(normalizedId);

  return {
    localId: createLocalId(),
    id: keepId ? normalizedId : createContactBookId(),
    previousId: keepId ? null : normalizedId,
    name: book.name,
    recipients: book.recipients
  };
}

function createEmptyBook(): ContactBookDraft {
  return {
    localId: createLocalId(),
    id: createContactBookId(),
    previousId: null,
    name: "New Contact Book",
    recipients: []
  };
}

export function ContactBooksManager({ initialBooks }: ContactBooksManagerProps) {
  const [books, setBooks] = useState<ContactBookDraft[]>(() =>
    initialBooks.map(toDraft)
  );
  const [isPending, startTransition] = useTransition();

  const updateBook = (index: number, next: ContactBookDraft) => {
    setBooks((current) => current.map((book, i) => (i === index ? next : book)));
  };

  const onSave = useCallback((book: ContactBookDraft) => {
    const recipients = normalizeRecipients(book.recipients);
    if (recipients.length === 0) {
      toast.error("Add at least one valid recipient email");
      return;
    }

    startTransition(async () => {
      const result = await saveContactBookAction({
        id: book.id.trim().toLowerCase(),
        previousId: book.previousId,
        name: book.name,
        recipients
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(`Saved contact book "${book.name}"`);
      setBooks((current) =>
        current.map((item) =>
          item.localId === book.localId
            ? { ...item, previousId: null, recipients }
            : item
        )
      );
    });
  }, [startTransition]);

  const onDelete = (book: ContactBookDraft) => {
    startTransition(async () => {
      const result = await deleteContactBookAction(book.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setBooks((current) => current.filter((item) => item.localId !== book.localId));
      toast.success(`Deleted "${book.name}"`);
    });
  };

  const onSaveShortcut = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    const localId =
      activeElement
        ?.closest<HTMLElement>("[data-contact-book-local-id]")
        ?.getAttribute("data-contact-book-local-id") ?? null;

    const targetBook = localId
      ? books.find((book) => book.localId === localId)
      : books.length === 1
        ? books[0]
        : null;

    if (!targetBook) {
      return;
    }

    onSave(targetBook);
  }, [books, onSave]);

  useSaveShortcut(onSaveShortcut, !isPending && books.length > 0);

  return (
    <div className="space-y-4">
      <Card className="panel rounded-2xl">
        <CardHeader className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Contacts</p>
            <h1 className="text-xl font-semibold">Manage Contact Books</h1>
          </div>
          <Button
            color="primary"
            startContent={<Plus className="h-4 w-4" />}
            type="button"
            onPress={() => setBooks((current) => [...current, createEmptyBook()])}
          >
            New Book
          </Button>
        </CardHeader>
      </Card>

      {books.length === 0 ? (
        <Card className="panel rounded-2xl">
          <CardBody>
            <p className="text-sm text-slate-300">
              No contact books yet. Create one to prefill recipients on the send page.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {books.map((book, index) => {
        return (
          <Card
            key={book.localId}
            className="panel rounded-2xl"
            data-contact-book-local-id={book.localId}
          >
            <CardBody className="space-y-4">
              <div className="grid gap-3">
                <Input
                  label="Name"
                  value={book.name}
                  onValueChange={(value) => updateBook(index, { ...book, name: value })}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-300">Recipients</p>
                <TagsInput
                  onInvalidTag={(value) => toast.error(`Invalid email: ${value}`)}
                  onChange={(next) => updateBook(index, { ...book, recipients: next })}
                  placeholder="Add recipient emails"
                  validateTag={isValidContactEmail}
                  value={book.recipients}
                />
              </div>

              <p className="text-xs text-slate-400">
                {book.recipients.length} recipient(s) in this book
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  color="primary"
                  isLoading={isPending}
                  startContent={<Save className="h-4 w-4" />}
                  type="button"
                  onPress={() => onSave(book)}
                >
                  Save Book
                </Button>
                <Button
                  color="danger"
                  isLoading={isPending}
                  startContent={<Trash2 className="h-4 w-4" />}
                  type="button"
                  variant="flat"
                  onPress={() => onDelete(book)}
                >
                  Delete Book
                </Button>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
