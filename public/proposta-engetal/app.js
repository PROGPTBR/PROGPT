const $ = id => document.getElementById(id),
	money = v => v.toLocaleString('pt-BR', {
		style: 'currency',
		currency: 'BRL'
	}),
	num = v => v.toLocaleString('pt-BR', {
		maximumFractionDigits: 1
	});
const plans = [{
 name: 'Essencial · Inicial',
 volume: 300,
 price: 2700,
 regular: 2700,
 assistants: 20,
 management: false,
 tag: 'PARA COMEÇAR',
 special: false
}, {
 name: 'Essencial · Recomendado',
 volume: 400,
 price: 3800,
 regular: 3800,
 assistants: 25,
 management: true,
 tag: 'ACOMPANHA O CRESCIMENTO',
 special: false
}];
let chosen = 1,
	summary = '';
const features = [
	['Cota e negocia com vários fornecedores', 'Envia os itens e negocia preço, frete, prazo e pagamento conforme as condições da Engetal, considerando o endereço da obra e o CNPJ de faturamento.'],
	['Pergunta antes de cotar', 'Identifica descrições incompletas e solicita material, bitola, pressão e outras especificações. Divergências de item e quantidade ficam sinalizadas.'],
	['Lê a proposta do jeito que ela chegar', 'PDF, foto, áudio ou print: organiza os preços no mapa e solicita os itens que ficaram faltando.'],
	['Cobra quem ainda não respondeu', 'Follow-up automático no intervalo definido pelo time, enquanto o comprador segue com outras atividades.'],
	['Monta o mapa e mostra oportunidades', 'Equaliza itens, frete, desconto e pagamento. Compara fornecedor único e mix, mantendo o desempate e o pedido com o comprador.'],
	['Busca novos fornecedores', 'Pesquisa distribuidores, lojas e atacados no raio da obra, com avaliações e validação de WhatsApp.'],
	['Para, pergunta e registra', 'Quando há dúvida, aciona o comprador. Conversas, propostas e mapas ficam registrados, com histórico em Excel ou PDF.']
];
const featuresEl = $('features');
if (featuresEl) featuresEl.innerHTML = features.map(([t, p]) => `<article class="feature"><span>↗</span><div><h3>${t}</h3><p>${p}</p></div></article>`).join('');
$('plans').innerHTML = plans.map((p, i) => `<button class="plan" data-plan="${i}" aria-pressed="${i===chosen}"><span class="tag">${p.tag}</span><h3>${p.name}</h3><p>${p.assistants} Assistentes</p><b class="volume">${p.volume} negociações/mês</b>${p.management?'<p>+ Assistentes de Gestão de Obras</p>':''}<strong>${money(p.price)}</strong><small>Plano mensal</small><p>${money(p.price/p.volume)} por negociação</p><span class="select">${i===chosen?'✓ Plano selecionado':'Selecionar este plano →'}</span></button>`).join('');

function val(id, min = 0) {
	const v = Number($(id).value);
	return Number.isFinite(v) ? Math.max(min, v) : min
}

function update() {
	const p = plans[chosen],
		salary = val('salary', 1),
		charges = val('charges'),
		hours = val('hours', .1),
		suppliers = val('suppliers', 1),
		q = val('quotes', 1),
		after = val('after'),
		vol = val('volume'),
		saving = Math.min(100, val('saving')),
		people = Math.min(4, val('people', 1));
	const cost = salary * (1 + charges / 100),
		capacity = 160 / hours * suppliers,
		human = cost / capacity,
		unit = p.price / p.volume,
		coverage = Math.min(1, p.volume / (q * suppliers)),
		saved = q * Math.max(0, hours - after) * coverage,
		hourValue = saved * cost / 160,
		savingValue = vol * coverage * saving / 100,
		benefit = hourValue + savingValue,
		training = people * 5 * cost / 160,
		annualFee = p.special ? p.price * 3 + p.regular * 9 : p.price * 12,
		second = chosen === 3 ? 680 * 9 : 0;
	let set = (id, v) => $(id).textContent = v;
	set('personCost', money(cost));
	set('humanUnit', money(human));
	set('aiUnit', money(unit));
	set('costSaving', `${num(Math.abs(1-unit/human)*100)}% ${unit<=human?'menor':'maior'} por negociação`);
	$('costBar').style.width = `${Math.min(100,unit/human*100)}%`;
	set('quotesCoverage', num(p.volume / 6));
	set('savedHours', num(saved) + ' h');
	set('returnValue', money(benefit));
	set('returnRatio', num(benefit / p.price) + '×');
	set('hoursValue', money(hourValue));
	set('savingValue', money(savingValue));
	set('benefit', money(benefit));
	set('monthly', money(p.price));
	set('training', money(training));
	set('firstMonth', money(p.price + 3825 + training));
	$('scenarios').innerHTML = [
		['Conservador', 3],
		['Intermediário', 5],
		['Projetado', 8]
	].map(([n, s]) => `<tr><td>${n}</td><td>${s}%</td><td>${money(hourValue+vol*coverage*s/100)}</td><td>${num((hourValue+vol*coverage*s/100)/p.price)}×</td></tr>`).join('');
	set('annual', `Em 12 meses: benefício estimado de ${money(benefit*12)} e saldo econômico de ${money(benefit*12-annualFee-second-3825-training)}, descontando mensalidades, implantação e tempo de treinamento.${chosen===3?' Considera a manutenção da segunda assistente a R$ 680/mês a partir de fevereiro.':''}`);
	summary = `PROGPT — Proposta para Engetal\n${p.name}\n${p.volume} negociações/mês\n${p.assistants} assistentes${p.management?" + Assistentes de Gestão de Obras":""}\nMensalidade: ${money(p.price)}${p.special?' em novembro/2026, dezembro/2026 e janeiro/2027':''}\n${p.special?'A partir de fevereiro/2027: '+money(p.regular)+'/mês\n':''}${chosen===3?'2ª assistente: gratuita nos 3 primeiros meses; depois R$ 680/mês, caso mantida.\n':''}Implantação (única): R$ 3.825,00\nTreinamento de até 4 pessoas incluído.\nPlano mensal. Proposta válida até 30/10/2026.\nKick-off em até 2 dias úteis após a assinatura.\nIntegração com Siecon sujeita à validação técnica da API.`;
	$('summaryText').textContent = summary;
}
document.querySelectorAll('.plan').forEach(b => b.addEventListener('click', () => {
	chosen = Number(b.dataset.plan);
	document.querySelectorAll('.plan').forEach(x => {
		const active = x === b;
		x.setAttribute('aria-pressed', String(active));
		x.querySelector('.select').textContent = active ? '✓ Plano selecionado' : 'Selecionar este plano →'
	});
	update()
}));
document.querySelectorAll('input').forEach(i => i.addEventListener('input', update));
$('summaryButton').onclick = () => {
	$('copyStatus').textContent = '';
	$('summary').showModal()
};
document.querySelector('.close').onclick = () => $('summary').close();
$('copy').onclick = async () => {
	try {
		await navigator.clipboard.writeText(summary);
		$('copyStatus').textContent = 'Resumo copiado. Compartilhe com a PROGPT para continuar.'
	} catch {
		$('copyStatus').textContent = 'Selecione o resumo acima e copie com Ctrl+C.'
	}
};
update();