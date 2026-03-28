async function carregarEventos() {
  const { data, error } = await supabase
    .from('events')
    .select('id, client_name')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar eventos:', error);
  }

  setEventos(data || []);
}
