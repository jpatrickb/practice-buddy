import { Check, Moon, Palette, Sun, SunMoon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ACCENTS, useTheme, type Mode } from "@/lib/theme";

const MODES: { id: Mode; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "Match my phone", Icon: SunMoon },
];

export function ThemeMenu() {
  const { mode, accent, setMode, setAccent } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-lg" aria-label="Appearance" className="size-11 rounded-full">
          <Palette className="size-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        {MODES.map(({ id, label, Icon }) => (
          <DropdownMenuItem key={id} className="min-h-11 text-base" onSelect={() => setMode(id)}>
            <Icon className="size-5" /> {label}
            {mode === id && <Check className="ml-auto size-5" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Color</DropdownMenuLabel>
        <div className="flex gap-3 px-2 pb-2" role="radiogroup" aria-label="Color">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              role="radio"
              aria-checked={accent === a.id}
              aria-label={a.label}
              onClick={() => setAccent(a.id)}
              className="grid size-11 place-items-center rounded-full ring-offset-2 ring-offset-popover focus-visible:ring-2 focus-visible:ring-ring aria-checked:ring-2 aria-checked:ring-foreground"
              style={{ background: a.swatch }}
            >
              {accent === a.id && <Check className="size-5 text-white" />}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
