const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Barbershop {
  id: number;
  Nome: string;
  Endereco: string;
  Telefone: string;
  Email: string;
  horario_abertura: string;
  horario_fechamento: string;
  Dono: number;
}

export interface Service {
  id: number;
  Nome: string;
  Descricao: string;
  Preco: string;
  Barbearia: number;
}

export interface Scheduling {
  id: number;
  cliente: number;
  servico: Service;
  descricao: string | null;
  data_agendamento: string;
  horario_agendamento: string;
}

function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getBarbershops(): Promise<Barbershop[]> {
  const response = await fetch(`${API_BASE_URL}/barbshop/`, {
    headers: authHeaders(),
  });
  
  if (!response.ok) {
    throw new Error("Erro ao buscar barbearias");
  }
  
  const data = await response.json();
  return data.barbershops || [];
}

export async function getServices(barbershopId: number): Promise<Service[]> {
  const response = await fetch(`${API_BASE_URL}/service/?id=${barbershopId}`, {
    headers: authHeaders(),
  });
  
  if (!response.ok) {
    return [];
  }
  
  const data = await response.json();
  return data.services || [];
}

export async function getAvailableTimes(date: string): Promise<string[]> {
  const response = await fetch(
    `${API_BASE_URL}/scheduling/available_times/?date=${date}`,
    {
      headers: authHeaders(),
    }
  );
  
  if (!response.ok) {
    throw new Error("Erro ao buscar horarios disponiveis");
  }
  
  const data = await response.json();
  return data.available_times || [];
}

export async function createScheduling(data: {
  servico: number;
  data_agendamento: string;
  horario_agendamento: string;
  descricao?: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/scheduling/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erro ao criar agendamento");
  }
}

export async function getMySchedulings(): Promise<Scheduling[]> {
  const response = await fetch(`${API_BASE_URL}/scheduling/`, {
    headers: authHeaders(),
  });
  
  if (!response.ok) {
    throw new Error("Erro ao buscar agendamentos");
  }
  
  const data = await response.json();
  return data || [];
}

export async function cancelScheduling(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/scheduling/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  
  if (!response.ok) {
    throw new Error("Erro ao cancelar agendamento");
  }
}
