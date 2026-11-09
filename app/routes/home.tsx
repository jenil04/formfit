import { redirect } from "react-router";

// Formfit has no separate Get started page: the workspace is home.
export function loader() {
  return redirect("/fit");
}

export function meta() {
  return [{ title: "Formfit" }];
}

export default function HomeRoute() {
  return null;
}
