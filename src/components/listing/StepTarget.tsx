/**
 * Where a builder step saves.
 *
 * The same five steps now fill in two things: a club that exists, addressed by
 * its slug, and a listing that does not, addressed by its draft id. Rather than
 * every step carrying both and a ternary, each carries this and renders the one
 * hidden field the action needs.
 *
 * The step name rides along because every step was repeating that too.
 */
export type StepTarget =
  | { kind: "club"; slug: string }
  | {
      kind: "draft";
      id: number;
      /**
       * A site admin, on a listing somebody else sent in (0202).
       *
       * It saves to the same place as the club's own draft, so this changes
       * nothing about the write. What it changes is the sentence at the foot
       * of every step: "nobody sees it yet, you send it to us from the last
       * step" is written for the club, and the admin IS us.
       */
      asAdmin?: boolean;
    };

export default function StepTargetFields({
  target, step,
}: {
  target: StepTarget;
  step: string;
}) {
  return (
    <>
      {target.kind === "club"
        ? <input type="hidden" name="slug" value={target.slug} />
        : <input type="hidden" name="draft" value={target.id} />}
      <input type="hidden" name="step" value={step} />
    </>
  );
}
