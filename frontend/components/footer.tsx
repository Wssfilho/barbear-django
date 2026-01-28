import Link from "next/link";
import { Scissors } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <Scissors className="h-6 w-6 text-primary" />
              <span className="font-serif text-xl font-bold text-foreground">BarberPro</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Sistema profissional de agendamento para barbearias. Conectando clientes e barbeiros.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Links</h4>
            <nav className="flex flex-col gap-2">
              <Link
                href="/barbearias"
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                Barbearias
              </Link>
              <Link
                href="/login"
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                Cadastrar
              </Link>
            </nav>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Para Barbeiros</h4>
            <nav className="flex flex-col gap-2">
              <Link
                href="/cadastro?tipo=barbeiro"
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                Cadastrar Barbearia
              </Link>
              <Link
                href="/minha-barbearia"
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                Gerenciar Servicos
              </Link>
            </nav>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Contato</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>contato@barberpro.com</p>
              <p>(11) 99999-9999</p>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          <p>2026 BarberPro. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
