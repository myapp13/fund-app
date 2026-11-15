import { createFileRoute } from "@tanstack/react-router";
import { DeskApp } from "@/components/desk/desk-app";
import { loadBoardFn } from "@/lib/funds/api";

export const Route = createFileRoute("/")({
  loader: () => loadBoardFn({ data: { extraIsins: [], refresh: false } }),
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <DeskApp initial={initial} />;
}
