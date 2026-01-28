"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import {
  getServices,
  getBarbershops,
  getAvailableTimes,
  createScheduling,
  type Service,
  type Barbershop,
} from "@/lib/api";
import { ArrowLeft, Calendar as CalendarIcon, Clock, Loader2, Scissors, CheckCircle } from "lucide-react";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AgendarPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [service, setService] = useState<Service | null>(null);
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTimes, setIsLoadingTimes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/login?redirect=/agendar/${serviceId}`);
    }
  }, [isAuthenticated, authLoading, router, serviceId]);

  useEffect(() => {
    async function fetchServiceData() {
      try {
        const barbershops = await getBarbershops();

        for (const shop of barbershops) {
          const services = await getServices(shop.id);
          const foundService = services.find((s) => s.id === parseInt(serviceId));

          if (foundService) {
            setService(foundService);
            setBarbershop(shop);
            break;
          }
        }

        if (!service && !barbershop) {
          setError("Servico nao encontrado");
        }
      } catch (err) {
        setError("Erro ao carregar dados");
      } finally {
        setIsLoading(false);
      }
    }

    if (isAuthenticated) {
      fetchServiceData();
    }
  }, [serviceId, isAuthenticated]);

  useEffect(() => {
    async function fetchAvailableTimes() {
      if (!selectedDate) return;

      setIsLoadingTimes(true);
      setSelectedTime(null);

      try {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const times = await getAvailableTimes(dateStr);
        setAvailableTimes(times);
      } catch (err) {
        toast({
          title: "Erro",
          description: "Nao foi possivel carregar os horarios disponiveis",
          variant: "destructive",
        });
      } finally {
        setIsLoadingTimes(false);
      }
    }

    fetchAvailableTimes();
  }, [selectedDate, toast]);

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime || !service) return;

    setIsSubmitting(true);

    try {
      await createScheduling({
        servico: service.id,
        data_agendamento: format(selectedDate, "yyyy-MM-dd"),
        horario_agendamento: selectedTime,
        descricao: description || undefined,
      });

      setSuccess(true);
      toast({
        title: "Agendamento confirmado!",
        description: "Seu horario foi reservado com sucesso.",
      });
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Nao foi possivel criar o agendamento",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(price));
  };

  if (authLoading || isLoading) {
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

  if (error || !service || !barbershop) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center">
          <Scissors className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="mb-4 text-muted-foreground">{error || "Servico nao encontrado"}</p>
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

  if (success) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <h1 className="mb-2 font-serif text-3xl font-bold text-foreground">
              Agendamento Confirmado!
            </h1>
            <p className="mb-6 text-muted-foreground">
              Seu horario foi reservado com sucesso. Voce pode ver seus agendamentos na
              sua area do cliente.
            </p>
            <div className="mb-8 rounded-lg border border-border bg-card p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Servico:</span>
                  <span className="font-medium text-foreground">{service.Nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Barbearia:</span>
                  <span className="font-medium text-foreground">{barbershop.Nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data:</span>
                  <span className="font-medium text-foreground">
                    {selectedDate && format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Horario:</span>
                  <span className="font-medium text-foreground">{selectedTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor:</span>
                  <span className="font-medium text-primary">
                    {formatPrice(service.Preco)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="flex-1">
                <Link href="/meus-agendamentos">Ver Meus Agendamentos</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/barbearias">Agendar Outro</Link>
              </Button>
            </div>
          </div>
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
            <Link href={`/barbearias/${barbershop.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>

          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold text-foreground">
              Agendar Servico
            </h1>
            <p className="mt-2 text-muted-foreground">
              Escolha a data e horario para seu agendamento
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Service Info */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scissors className="h-5 w-5 text-primary" />
                  {service.Nome}
                </CardTitle>
                <CardDescription>{service.Descricao}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Barbearia:</span>
                    <span className="text-foreground">{barbershop.Nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-semibold text-primary">
                      {formatPrice(service.Preco)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Calendar */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  Selecione a Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-8 lg:flex-row">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) =>
                      isBefore(date, startOfDay(new Date())) ||
                      isBefore(addDays(new Date(), 30), date)
                    }
                    locale={ptBR}
                    className="rounded-md border"
                  />

                  {selectedDate && (
                    <div className="flex-1">
                      <h3 className="mb-4 flex items-center gap-2 font-medium text-foreground">
                        <Clock className="h-4 w-4 text-primary" />
                        Horarios Disponiveis
                      </h3>

                      {isLoadingTimes ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : availableTimes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhum horario disponivel para esta data
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {availableTimes.map((time) => (
                            <Button
                              key={time}
                              variant={selectedTime === time ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedTime(time)}
                            >
                              {time}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            {selectedTime && (
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Observacoes (Opcional)</CardTitle>
                  <CardDescription>
                    Adicione informacoes adicionais para o barbeiro
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Ex: Gostaria de um corte mais curto nas laterais..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {format(selectedDate!, "dd 'de' MMMM", { locale: ptBR })}
                      </span>{" "}
                      as{" "}
                      <span className="font-medium text-foreground">{selectedTime}</span>
                    </div>
                    <Button
                      size="lg"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Confirmando...
                        </>
                      ) : (
                        "Confirmar Agendamento"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
