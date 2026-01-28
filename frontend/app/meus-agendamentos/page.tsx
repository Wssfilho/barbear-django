"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getMySchedulings, cancelScheduling, type Scheduling } from "@/lib/api";
import { Calendar, Clock, Scissors, Loader2, X, CalendarPlus } from "lucide-react";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MeusAgendamentosPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();

  const [schedulings, setSchedulings] = useState<Scheduling[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login?redirect=/meus-agendamentos");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    async function fetchSchedulings() {
      if (!isAuthenticated) return;

      try {
        const data = await getMySchedulings();
        // Sort by date and time, most recent first
        const sorted = data.sort((a, b) => {
          const dateA = new Date(`${a.data_agendamento}T${a.horario_agendamento}`);
          const dateB = new Date(`${b.data_agendamento}T${b.horario_agendamento}`);
          return dateB.getTime() - dateA.getTime();
        });
        setSchedulings(sorted);
      } catch (err) {
        toast({
          title: "Erro",
          description: "Nao foi possivel carregar seus agendamentos",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchSchedulings();
  }, [isAuthenticated, toast]);

  const handleCancel = async (id: number) => {
    setCancelingId(id);

    try {
      await cancelScheduling(id);
      setSchedulings((prev) => prev.filter((s) => s.id !== id));
      toast({
        title: "Agendamento cancelado",
        description: "Seu agendamento foi cancelado com sucesso.",
      });
    } catch (err) {
      toast({
        title: "Erro",
        description: "Nao foi possivel cancelar o agendamento",
        variant: "destructive",
      });
    } finally {
      setCancelingId(null);
    }
  };

  const isPastScheduling = (dateStr: string, timeStr: string) => {
    const schedulingDate = new Date(`${dateStr}T${timeStr}`);
    return isBefore(schedulingDate, new Date());
  };

  const upcomingSchedulings = schedulings.filter(
    (s) => !isPastScheduling(s.data_agendamento, s.horario_agendamento)
  );
  const pastSchedulings = schedulings.filter((s) =>
    isPastScheduling(s.data_agendamento, s.horario_agendamento)
  );

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

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-serif text-3xl font-bold text-foreground">
                Meus Agendamentos
              </h1>
              <p className="mt-2 text-muted-foreground">
                Ola, {user?.first_name}! Aqui estao seus agendamentos.
              </p>
            </div>
            <Button asChild>
              <Link href="/barbearias">
                <CalendarPlus className="mr-2 h-4 w-4" />
                Novo Agendamento
              </Link>
            </Button>
          </div>

          {schedulings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Calendar className="mb-4 h-16 w-16 text-muted-foreground" />
              <h2 className="mb-2 text-xl font-semibold text-foreground">
                Nenhum agendamento
              </h2>
              <p className="mb-6 text-center text-muted-foreground">
                Voce ainda nao tem agendamentos. Que tal agendar um corte?
              </p>
              <Button asChild>
                <Link href="/barbearias">Ver Barbearias</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Upcoming */}
              {upcomingSchedulings.length > 0 && (
                <section>
                  <h2 className="mb-4 font-serif text-xl font-semibold text-foreground">
                    Proximos Agendamentos
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {upcomingSchedulings.map((scheduling) => (
                      <SchedulingCard
                        key={scheduling.id}
                        scheduling={scheduling}
                        onCancel={handleCancel}
                        isCanceling={cancelingId === scheduling.id}
                        isPast={false}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Past */}
              {pastSchedulings.length > 0 && (
                <section>
                  <h2 className="mb-4 font-serif text-xl font-semibold text-muted-foreground">
                    Historico
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pastSchedulings.map((scheduling) => (
                      <SchedulingCard
                        key={scheduling.id}
                        scheduling={scheduling}
                        onCancel={handleCancel}
                        isCanceling={cancelingId === scheduling.id}
                        isPast={true}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function SchedulingCard({
  scheduling,
  onCancel,
  isCanceling,
  isPast,
}: {
  scheduling: Scheduling;
  onCancel: (id: number) => void;
  isCanceling: boolean;
  isPast: boolean;
}) {
  const formatPrice = (price: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(price));
  };

  return (
    <Card className={isPast ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <Scissors className="h-4 w-4 text-primary" />
            {scheduling.servico.Nome}
          </CardTitle>
          <Badge variant={isPast ? "secondary" : "default"}>
            {isPast ? "Realizado" : "Confirmado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {format(parseISO(scheduling.data_agendamento), "dd 'de' MMMM 'de' yyyy", {
              locale: ptBR,
            })}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            {scheduling.horario_agendamento.slice(0, 5)}
          </div>
          <div className="font-medium text-primary">
            {formatPrice(scheduling.servico.Preco)}
          </div>
        </div>

        {scheduling.descricao && (
          <p className="text-sm text-muted-foreground">{scheduling.descricao}</p>
        )}

        {!isPast && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full" disabled={isCanceling}>
                {isCanceling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    Cancelar
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar Agendamento</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja cancelar este agendamento? Esta acao nao pode ser
                  desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Nao, manter</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onCancel(scheduling.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sim, cancelar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}
