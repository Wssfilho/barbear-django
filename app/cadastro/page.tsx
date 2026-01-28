"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Scissors, Loader2 } from "lucide-react";

function RegisterForm() {
  const searchParams = useSearchParams();
  const tipoParam = searchParams.get("tipo");

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    first_name: "",
    email: "",
    telefone: "",
    cpf: "",
    tipo_usuario: tipoParam === "barbeiro" ? "2" : "1",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas nao conferem.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await register({
        username: formData.username,
        password: formData.password,
        first_name: formData.first_name,
        email: formData.email,
        telefone: formData.telefone,
        cpf: formData.cpf,
        tipo_usuario: parseInt(formData.tipo_usuario),
      });
      toast({
        title: "Conta criada com sucesso!",
        description: "Bem-vindo ao BarberPro.",
      });
      router.push("/barbearias");
    } catch (error) {
      toast({
        title: "Erro no cadastro",
        description: "Nao foi possivel criar sua conta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Scissors className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground">
            Criar Conta
          </h1>
          <p className="mt-2 text-muted-foreground">
            Preencha seus dados para comecar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Conta</Label>
              <RadioGroup
                value={formData.tipo_usuario}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, tipo_usuario: value }))
                }
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1" id="cliente" />
                  <Label htmlFor="cliente" className="cursor-pointer">
                    Cliente
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="2" id="barbeiro" />
                  <Label htmlFor="barbeiro" className="cursor-pointer">
                    Barbeiro
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="first_name">Nome Completo</Label>
              <Input
                id="first_name"
                name="first_name"
                type="text"
                placeholder="Seu nome completo"
                value={formData.first_name}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Escolha um usuario"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  name="telefone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={formData.telefone}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  name="cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  value={formData.cpf}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Crie uma senha"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirme sua senha"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando conta...
              </>
            ) : (
              "Criar Conta"
            )}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          Ja tem uma conta?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Entre aqui
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function CadastroPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <Suspense fallback={<div className="flex-1" />}>
        <RegisterForm />
      </Suspense>
      <Footer />
    </div>
  );
}
