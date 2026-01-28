"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBarbershops, type Barbershop } from "@/lib/api";
import { MapPin, Phone, Mail, Clock, Search, Store, Loader2 } from "lucide-react";

export default function BarbeariasPage() {
  const [barbershops, setBarbershops] = useState<Barbershop[]>([]);
  const [filteredBarbershops, setFilteredBarbershops] = useState<Barbershop[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBarbershops() {
      try {
        const data = await getBarbershops();
        setBarbershops(data);
        setFilteredBarbershops(data);
      } catch (err) {
        setError("Erro ao carregar barbearias");
      } finally {
        setIsLoading(false);
      }
    }

    fetchBarbershops();
  }, []);

  useEffect(() => {
    const filtered = barbershops.filter(
      (shop) =>
        shop.Nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shop.Endereco.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredBarbershops(filtered);
  }, [searchTerm, barbershops]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
              Barbearias
            </h1>
            <p className="mt-2 text-muted-foreground">
              Encontre a barbearia perfeita para voce
            </p>
          </div>

          <div className="mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou endereco..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Store className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : filteredBarbershops.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Store className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchTerm
                  ? "Nenhuma barbearia encontrada com esse termo"
                  : "Nenhuma barbearia cadastrada ainda"}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredBarbershops.map((shop) => (
                <BarbershopCard key={shop.id} barbershop={shop} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function BarbershopCard({ barbershop }: { barbershop: Barbershop }) {
  const formatTime = (time: string) => {
    return time.slice(0, 5);
  };

  return (
    <Card className="group transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-xl">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Store className="h-5 w-5" />
          </div>
          {barbershop.Nome}
        </CardTitle>
        <CardDescription className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {barbershop.Endereco}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            {barbershop.Telefone}
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {barbershop.Email}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {formatTime(barbershop.horario_abertura)} -{" "}
            {formatTime(barbershop.horario_fechamento)}
          </div>
        </div>

        <Button asChild className="w-full">
          <Link href={`/barbearias/${barbershop.id}`}>Ver Servicos</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
