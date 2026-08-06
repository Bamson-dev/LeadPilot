import { Panel, PanelContent } from "@/components/ui/panel";
import { PaywallValueRow } from "@/components/public/freetrial/trial-ui";
import { cn } from "@/utils/utils";

export function CheckoutTierOnePanel({
  items,
  className,
}: {
  items: readonly { item: string; price: string }[];
  className?: string;
}) {
  return (
    <Panel className={cn("border-[var(--lt-accent)]/20 bg-[var(--lt-accent)]/5", className)}>
      <PanelContent className="space-y-0 p-4">
        <p className="mb-3 text-sm font-extrabold text-[var(--lt-text)]">What you are getting</p>
        <ul className="m-0 flex list-none flex-col gap-0 p-0">
          {items.map((row) => (
            <PaywallValueRow key={row.item} label={row.item} compareAt={row.price} />
          ))}
        </ul>
      </PanelContent>
    </Panel>
  );
}

export function CheckoutTierTwoPanel({
  items,
  className,
}: {
  items: readonly string[];
  className?: string;
}) {
  return (
    <Panel className={cn("border-[var(--lt-success)]/20 bg-[var(--lt-success)]/5", className)}>
      <PanelContent className="space-y-0 p-4">
        <p className="mb-3 text-sm font-extrabold text-[var(--lt-success)]">
          Included when you claim a slot today
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((item) => (
            <PaywallValueRow key={item} label={item} free />
          ))}
        </ul>
      </PanelContent>
    </Panel>
  );
}
