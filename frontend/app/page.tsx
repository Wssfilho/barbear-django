import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Scissors, Calendar, Clock, Star, MapPin, Phone } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-background">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0a0a0a_1px,transparent_1px),linear-gradient(to_bottom,#0a0a0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />
          <div className="container relative mx-auto px-4 py-24 md:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm text-primary">
                <Scissors className="h-4 w-4" />
                Sistema de Agendamento Premium
              </div>
              <h1 className="font-serif text-4xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
                <span className="text-balance">A experiencia completa em</span>{" "}
                <span className="text-primary">barbearia</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                Agende seu corte de cabelo e barba nas melhores barbearias da cidade.
                Profissionais qualificados, ambiente premium e atendimento de excelencia.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button size="lg" asChild className="w-full sm:w-auto">
                  <Link href="/barbearias">Agendar Agora</Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                  <Link href="/cadastro?tipo=barbeiro">Sou Barbeiro</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="border-y border-border bg-card/50">
          <div className="container mx-auto px-4 py-12">
            <div className="grid gap-8 md:grid-cols-4">
              {[
                { value: "500+", label: "Barbearias Parceiras" },
                { value: "10K+", label: "Agendamentos/Mes" },
                { value: "98%", label: "Clientes Satisfeitos" },
                { value: "24/7", label: "Agendamento Online" },
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="font-serif text-3xl font-bold text-primary md:text-4xl">
                    {stat.value}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-background py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
                Por que escolher o BarberPro?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Oferecemos a melhor experiencia de agendamento para barbearias
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-3">
              <FeatureCard
                icon={<Calendar className="h-8 w-8" />}
                title="Agendamento Facil"
                description="Agende seu horario em poucos cliques. Escolha a barbearia, o servico e o melhor horario para voce."
              />
              <FeatureCard
                icon={<Clock className="h-8 w-8" />}
                title="Horarios em Tempo Real"
                description="Veja a disponibilidade dos barbeiros em tempo real. Sem surpresas, sem esperas."
              />
              <FeatureCard
                icon={<Star className="h-8 w-8" />}
                title="Servicos Premium"
                description="Encontre os melhores servicos: corte, barba, tratamentos capilares e muito mais."
              />
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="border-y border-border bg-card/50 py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
                Como Funciona
              </h2>
              <p className="mt-4 text-muted-foreground">
                Agendar seu proximo corte nunca foi tao facil
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-3">
              <StepCard
                number="01"
                title="Escolha a Barbearia"
                description="Navegue pelas barbearias disponiveis e escolha a que mais combina com voce."
              />
              <StepCard
                number="02"
                title="Selecione o Servico"
                description="Escolha entre corte, barba, tratamentos e outros servicos disponiveis."
              />
              <StepCard
                number="03"
                title="Agende seu Horario"
                description="Selecione a data e horario disponivel e confirme seu agendamento."
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-primary py-24">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-serif text-3xl font-bold text-primary-foreground md:text-4xl">
              Pronto para transformar seu visual?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/80">
              Junte-se a milhares de clientes satisfeitos e agende seu proximo corte agora mesmo.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                variant="secondary"
                asChild
                className="w-full sm:w-auto"
              >
                <Link href="/barbearias">Ver Barbearias</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="w-full border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto"
              >
                <Link href="/cadastro">Criar Conta</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-lg border border-border bg-card p-8 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
      <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
        {icon}
      </div>
      <h3 className="font-serif text-xl font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-lg border border-border bg-card p-8">
      <div className="absolute -top-4 left-6 font-serif text-5xl font-bold text-primary/20">
        {number}
      </div>
      <div className="pt-4">
        <h3 className="font-serif text-xl font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
