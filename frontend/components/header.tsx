"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Scissors, User, Menu, X, Calendar, LogOut, Store } from "lucide-react";
import { useState } from "react";

export function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Scissors className="h-6 w-6 text-primary" />
          <span className="font-serif text-xl font-bold text-foreground">BarberPro</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/barbearias"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Barbearias
          </Link>
          {isAuthenticated && (
            <Link
              href="/meus-agendamentos"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Meus Agendamentos
            </Link>
          )}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <User className="h-4 w-4" />
                  {user?.first_name || "Usuario"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/meus-agendamentos" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Meus Agendamentos
                  </Link>
                </DropdownMenuItem>
                {user?.tipo_usuario === 2 && (
                  <DropdownMenuItem asChild>
                    <Link href="/minha-barbearia" className="flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      Minha Barbearia
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild>
                <Link href="/cadastro">Cadastrar</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6 text-foreground" />
          ) : (
            <Menu className="h-6 w-6 text-foreground" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="container mx-auto flex flex-col gap-4 px-4 py-4">
            <Link
              href="/barbearias"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              onClick={() => setMobileMenuOpen(false)}
            >
              Barbearias
            </Link>
            {isAuthenticated && (
              <Link
                href="/meus-agendamentos"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                Meus Agendamentos
              </Link>
            )}
            <div className="flex flex-col gap-2 pt-4">
              {isAuthenticated ? (
                <Button variant="outline" onClick={logout} className="w-full">
                  Sair
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/login">Entrar</Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link href="/cadastro">Cadastrar</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
