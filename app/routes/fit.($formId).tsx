import Workspace from "@/components/fit/Workspace";
import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [
    { title: `${APP_TITLE}: your answer bank, fitted to every form` },
    {
      name: "description",
      content:
        "Draft every application field from your answer bank, fitted to the exact limit, without inventing a number.",
    },
  ];
}

export default function FitRoute() {
  return <Workspace />;
}
