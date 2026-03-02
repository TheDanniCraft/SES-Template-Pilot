import { ContactBooksManager } from "@/components/contact-books-manager";
import { listContactBooks } from "@/lib/contact-books-store";
import { getServerSessionUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function ContactBooksPage() {
  const user = await getServerSessionUser();
  const books = user ? await listContactBooks(user.id) : [];
  return <ContactBooksManager initialBooks={books} />;
}
