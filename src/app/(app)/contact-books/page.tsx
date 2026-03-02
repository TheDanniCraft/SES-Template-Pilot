import { ContactBooksManager } from "@/components/contact-books-manager";
import { listContactBooks } from "@/lib/contact-books-store";

export const dynamic = "force-dynamic";

export default async function ContactBooksPage() {
  const books = await listContactBooks();
  return <ContactBooksManager initialBooks={books} />;
}
