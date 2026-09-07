import type { Metadata } from "next";
import Link from "next/link";

import {
  ReviewActions,
  ReviewComposer,
  ReviewStars,
} from "@/components/admin/ReviewAdmin";
import {
  ChipLink,
  ChipRow,
  DateText,
  EmptyRow,
  Note,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  SubText,
  TableShell,
  Td,
  Th,
  Tr,
} from "@/components/admin/ui";
import { listAdminReviews, listReviewTargets } from "@/lib/admin-queries";

export const metadata: Metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const [result, targets] = await Promise.all([
    listAdminReviews({
      state: one(params.state),
      page: Number(one(params.page)) || 1,
    }),
    listReviewTargets(),
  ]);

  const hrefWith = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams();
    const base: Record<string, string | number | null> = {
      state: result.state === "pending" ? null : result.state,
      page: result.page > 1 ? result.page : null,
    };
    for (const [key, value] of Object.entries({ ...base, ...changes })) {
      if (value !== null && value !== undefined && value !== "") next.set(key, String(value));
    }
    const search = next.toString();
    return search ? `/admin/reviews?${search}` : "/admin/reviews";
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Social proof"
        title="Reviews"
        description="Real customer reviews, typed in by the store and moderated here. Publishing one recalculates that product's star rating."
        action={<ReviewComposer targets={targets} />}
      />

      <Note tone="info">
        <strong className="font-semibold">Where reviews come from.</strong> Nothing on
        this site writes review text. The seed created none, and the storefront shows
        an empty state on any product without approved reviews rather than a star
        rating nothing supports. The 5.0 from 95 reviews shown on the home page is
        Yalman Gaming&rsquo;s <em>Google</em> rating for the shop, not a product score.
      </Note>

      <ChipRow>
        <ChipLink
          href={hrefWith({ state: null, page: null })}
          active={result.state === "pending"}
          count={result.pending}
        >
          Awaiting approval
        </ChipLink>
        <ChipLink
          href={hrefWith({ state: "approved", page: null })}
          active={result.state === "approved"}
          count={result.approved}
        >
          Published
        </ChipLink>
        <ChipLink
          href={hrefWith({ state: "all", page: null })}
          active={result.state === "all"}
          count={result.pending + result.approved}
        >
          All
        </ChipLink>
      </ChipRow>

      <Panel padded={false}>
        <TableShell minWidth="62rem">
          <thead>
            <tr>
              <Th>Review</Th>
              <Th>Product</Th>
              <Th>Rating</Th>
              <Th>State</Th>
              <Th align="right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <EmptyRow
                colSpan={5}
                title={
                  result.state === "approved"
                    ? "Nothing published yet"
                    : result.state === "all"
                      ? "No reviews have ever been entered"
                      : "Nothing waiting for approval"
                }
                description="Reviews come from real Yalman Gaming customers and are entered here by the store — none are seeded or generated. Use “Enter a customer review” above once someone gives you one, and the product's star rating follows from what you publish."
              />
            ) : (
              result.items.map((review) => (
                <Tr key={review.id}>
                  <Td className="max-w-md">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-chrome">
                        {review.authorName}
                        {review.verified && (
                          <span className="ml-2">
                            <Pill tone="emerald">Verified purchase</Pill>
                          </span>
                        )}
                      </span>
                      {review.title && (
                        <span className="text-sm font-medium text-silver">
                          {review.title}
                        </span>
                      )}
                      <p className="whitespace-pre-line text-xs leading-relaxed text-ash">
                        {review.body}
                      </p>
                      <SubText>
                        <DateText value={review.createdAt} />
                        {review.user?.email ? ` · ${review.user.email}` : ""}
                      </SubText>
                    </div>
                  </Td>

                  <Td>
                    <Link
                      href={`/admin/products/${review.product.id}`}
                      className="text-sm text-chrome hover:text-cyan"
                    >
                      {review.product.name}
                    </Link>
                    <SubText className="tnum font-mono">
                      now {review.product.rating.toFixed(1)} from{" "}
                      {review.product.reviewCount}
                    </SubText>
                  </Td>

                  <Td>
                    <ReviewStars rating={review.rating} />
                  </Td>

                  <Td>
                    {review.approved ? (
                      <Pill tone="emerald">Published</Pill>
                    ) : (
                      <Pill tone="ember">Waiting</Pill>
                    )}
                  </Td>

                  <Td align="right">
                    <ReviewActions
                      reviewId={review.id}
                      approved={review.approved}
                      productName={review.product.name}
                    />
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </TableShell>

        <Pagination
          page={result.page}
          pages={result.pages}
          total={result.total}
          perPage={result.perPage}
          hrefFor={(page) => hrefWith({ page: page > 1 ? page : null })}
          label="reviews"
        />
      </Panel>
    </div>
  );
}
