import Workspace from "@/components/fit/Workspace";
import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [{ title: `${APP_TITLE}: find a program` }];
}

export default function ProgramsRoute() {
  return <Workspace view="programs" />;
}
