import { cn } from "@/lib/utils";
import { Marquee } from "@/components/magicui/marquee";

const reviews = [
  {
    name: "Amit",
    username: "@amit",
    body: "Fast and reliable OTP services. Helped me verify accounts hassle-free!",
    img: "https://avatar.vercel.sh/amit",
  },
  {
    name: "Priya",
    username: "@priya",
    body: "I love the temporary OTP feature. Works like a charm every time!",
    img: "https://avatar.vercel.sh/priya",
  },
  {
    name: "Raj",
    username: "@raj",
    body: "Best virtual OTP service I've used so far. Affordable and efficient!",
    img: "https://avatar.vercel.sh/raj",
  },
  {
    name: "Sneha",
    username: "@sneha",
    body: "Super smooth experience. Got my OTP instantly. Highly recommended!",
    img: "https://avatar.vercel.sh/sneha",
  },
  {
    name: "Vikram",
    username: "@vikram",
    body: "Temporary OTPs are a lifesaver! Quick and easy to use.",
    img: "https://avatar.vercel.sh/vikram",
  },
  {
    name: "Neha",
    username: "@neha",
    body: "Reliable OTP service for all my online verifications. Works great!",
    img: "https://avatar.vercel.sh/neha",
  },
];

const firstRow = reviews.slice(0, reviews.length / 2);
const secondRow = reviews.slice(reviews.length / 2);

const ReviewCard = ({
  img,
  name,
  username,
  body,
}: {
  img: string;
  name: string;
  username: string;
  body: string;
}) => {
  return (
    <figure
      className={cn(
        "relative h-full w-64 cursor-pointer overflow-hidden rounded-xl border p-4",
        "border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]",
        "dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]"
      )}
    >
      <div className="flex flex-row items-center gap-2">
        <img className="rounded-full" width="32" height="32" alt="" src={img} />
        <div className="flex flex-col">
          <figcaption className="text-sm font-medium dark:text-white">
            {name}
          </figcaption>
          <p className="text-xs font-medium dark:text-white/40">{username}</p>
        </div>
      </div>
      <blockquote className="mt-2 text-sm">{body}</blockquote>
    </figure>
  );
};

export function MarqueeDemo() {
  return (
    <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
      <Marquee pauseOnHover className="[--duration:20s]">
        {firstRow.map((review) => (
          <ReviewCard key={review.username} {...review} />
        ))}
      </Marquee>
      <Marquee reverse pauseOnHover className="[--duration:20s]">
        {secondRow.map((review) => (
          <ReviewCard key={review.username} {...review} />
        ))}
      </Marquee>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-background"></div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-background"></div>
    </div>
  );
}

export default MarqueeDemo;
