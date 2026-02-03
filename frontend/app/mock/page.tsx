import MockClient from "./mock-client";

export default function MockPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  return <MockClient searchParams={searchParams} />;
}
