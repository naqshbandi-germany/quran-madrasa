import { ConfirmButton } from "@/components/confirm-button";
import { TrashIcon } from "@/components/icons";

// Entfernen-Aktion mit Papierkorb-Symbol und Text, fragt vor dem Loeschen nach.
export function RemoveForm({
  action,
  fields,
  message,
  label = "Entfernen",
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  message: string;
  label?: string;
}) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <ConfirmButton
        message={message}
        className="inline-flex items-center gap-1.5 font-medium text-red-800 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
      >
        <TrashIcon />
        {label}
      </ConfirmButton>
    </form>
  );
}
