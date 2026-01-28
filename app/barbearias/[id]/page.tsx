"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBarbershops, getServices, type Barbershop, type Service } from "@/lib/api";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  ArrowLeft,
  Scissors,
  Store,
  Loader2,
} from "lucide-react";

export default function BarbershopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const barbershops = await getBarbershops();
        const found = barbershops.find((b) => b.id === parseInt(id));
        
        if (found) {
          setBarbershop(found);
          const servicesData = await getServices(parseInt(id));
          setServices(servicesData);
        } else {
          setError("Barbearia nao encontrada");
        }
      } catch (err) {
        setError("Erro ao carregar dados");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [id]);

  const formatTime = (time: string) => {
    return time.slice(0, 5);
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(price));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !barbershop) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center">
          <Store className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="mb-4 text-muted-foreground">{error || "Barbearia nao encontrada"}</p>
          <Button asChild variant="outline">
            <Link href="/barbearias">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 bg-background">
        <div className="container mx-auto px-4 py-12">
          <Button asChild variant="ghost" className="mb-6">
            <Link href="/barbearias">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Barbershop Info */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Store className="h-8 w-8" />
                  </div>
                  <CardTitle className="font-serif text-2xl">{barbershop.Nome}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="text-muted-foreground">{barbershop.Endereco}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="text-muted-foreground">{barbershop.Telefone}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="text-muted-foreground">{barbershop.Email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="text-muted-foreground">
                        {formatTime(barbershop.horario_abertura)} -{" "}
                        {formatTime(barbershop.horario_fechamento)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Services */}
            <div className="lg:col-span-2">
              <h2 className="mb-6 font-serif text-2xl font-bold text-foreground">
                Servicos Disponiveis
              </h2>

              {services.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-12">
                  <Scissors className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Nenhum servico cadastrado ainda
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {services.map((service) => (
                    <ServiceCard key={service.id} service={service} formatPrice={formatPrice} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function ServiceCard({
  service,
  formatPrice,
}: {
  service: Service;
  formatPrice: (price: string) => string;
}) {
  return (
    <Card className="transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="font-serif text-lg">{service.Nome}</CardTitle>
          <span className="whitespace-nowrap font-semibold text-primary">
            {formatPrice(service.Preco)}
          </span>
        </div>
        <CardDescription>{service.Descricao}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full">
          <Link href={`/agendar/${service.id}`}>Agendar</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
