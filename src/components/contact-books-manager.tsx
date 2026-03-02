"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteContactBookAction, saveContactBookAction } from "@/lib/actions/contact-books";
import type { ContactBook } from "@/lib/contact-books";
import { isValidContactEmail, normalizeRecipients } from "@/lib/contact-books";
import { TagsInput } from "@/components/tags-input";

type ContactBooksManagerProps = {
  initialBooks: ContactBook[];
};

type ContactBookDraft = {
  id: string;
  name: string;
  recipients: string[];
};

function toDraft(book: ContactBook): ContactBookDraft {
  return {
    id: book.id,
    name: book.name,
    recipients: book.recipients
  };
}

function createEmptyBook(): ContactBookDraft {
  const id = `book-${Date.now()}`;
  return {
    id,
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

  const onSave = (book: ContactBookDraft) => {
    const recipients = normalizeRecipients(book.recipients);
    if (recipients.length === 0) {
      toast.error("Add at least one valid recipient email");
      return;
    }

    startTransition(async () => {
      const result = await saveContactBookAction({
        id: book.id.trim().toLowerCase(),
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
          item.id === book.id
            ? { ...item, recipients }
            : item
        )
      );
    });
  };

  const onDelete = (book: ContactBookDraft) => {
    startTransition(async () => {
      const result = await deleteContactBookAction(book.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setBooks((current) => current.filter((item) => item.id !== book.id));
      toast.success(`Deleted "${book.name}"`);
    });
  };

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
          <Card key={`${book.id}-${index}`} className="panel rounded-2xl">
            <CardBody className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="ID"
                  value={book.id}
                  onValueChange={(value) =>
                    updateBook(index, {
                      ...book,
                      id: value.trim().toLowerCase()
                    })
                  }
                />
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
