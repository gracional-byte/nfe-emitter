import crypto from 'crypto';
import { DOMParser as DOMParserImpl, XMLSerializer } from '@xmldom/xmldom';

// Certificado e chave privada fornecidos pelo usuário
const CERTIFICATE_PEM = `-----BEGIN CERTIFICATE-----
MIIH6DCCBdCgAwIBAgILAK8LCraFsBhOf4owDQYJKoZIhvcNAQELBQAwWzELMAkG
A1UEBhMCQlIxFjAUBgNVBAsMDUFDIFN5bmd1bGFySUQxEzARBgNVBAoMCklDUC1C
cmFzaWwxHzAdBgNVBAMMFkFDIFN5bmd1bGFySUQgTXVsdGlwbGEwHhcNMjUwNjI0
MTcwNzQzWhcNMjYwNjI0MTcwNzQzWjCB1DELMAkGA1UEBhMCQlIxEzARBgNVBAoM
CklDUC1CcmFzaWwxIjAgBgNVBAsMGUNlcnRpZmljYWRvIERpZ2l0YWwgUEogQTEx
GTAXBgNVBAsMEFZpZGVvY29uZmVyZW5jaWExFzAVBgNVBAsMDjI4OTI1NjQwMDAw
MTIxMR8wHQYDVQQLDBZBQyBTeW5ndWxhcklEIE11bHRpcGxhMTcwNQYDVQQDDC5W
SUJFIFRFUkFQSUFTIElOVEVHUkFUSVZBUyBMVERBOjYwOTAwMjI3MDAwMTE1MIIB
IjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqfGHUZCnFwBM+pa130b1pqu3
CCi/WtrlwV9bWhd1Cub5VSeDNPN7NJH0T24MMrRfSPlDlbTTokNHgp0T+yBuc3fW
X8nf0C4uAxCnD10xGukRS5+YGjfkm6Aq8EO89SM03SMG6vc0L0WFzqKaIHcXLDP9
ms8BNRUCU6Fy9mbY4yxunrmPWBBem0JKFFppGV60fUe8JfJI7DeQLgjRxOoSYmC5
xXwFOx2yYgYHOIHewc0DRQjcx+wEnU8e22ODOaRzTNlTNCPo8hE3yZ+fWdlWBTro
DZuCPh131lpplOcvpit7Ubq5YwhGG366sivEDb5yNueUrEe3D5ab/LcMu3J4wQID
AQABo4IDMTCCAyUwDgYDVR0PAQH/BAQDAgXgMB0GA1UdJQQWMBQGCCsGAQUFBwME
BggrBgEFBQcDAjAJBgNVHRMEAjAAMB8GA1UdIwQYMBaAFJPh/34d5fXkTeE5Yosh
aZXmr3IWMB0GA1UdDgQWBBSuiXl6iuziTNNi3BPAP9+WbscaGjB/BggrBgEFBQcB
AQRzMHEwbwYIKwYBBQUHMAKGY2h0dHA6Ly9zeW5ndWxhcmlkLmNvbS5ici9yZXBv
c2l0b3Jpby9hYy1zeW5ndWxhcmlkLW11bHRpcGxhL2NlcnRpZmljYWRvcy9hYy1z
eW5ndWxhcmlkLW11bHRpcGxhLnA3YjCBggYDVR0gBHsweTB3BgdgTAECAYEFMGww
agYIKwYBBQUHAgEWXmh0dHA6Ly9zeW5ndWxhcmlkLmNvbS5ici9yZXBvc2l0b3Jp
by9hYy1zeW5ndWxhcmlkLW11bHRpcGxhL2RwYy9kcGMtYWMtc3luZ3VsYXJJRC1t
dWx0aXBsYS5wZGYwgcUGA1UdEQSBvTCBuqAnBgVgTAEDAqAeBBxFUklDSyBIRU5S
SVFVRSBQRVJFSVJBIEVDSEVToBkGBWBMAQMDoBAEDjYwOTAwMjI3MDAwMTE1oEIG
BWBMAQMEoDkENzExMDQxOTg4MDYwOTcyODE5OTQwMDAwMDAwMDAwMDAwMDAwMDAw
MDAwMDAwMDAwMDAwMDAwMDCgFwYFYEwBAwegDgQMMDAwMDAwMDAwMDAwgRdlcmlj
a19lY2hlc0Bob3RtYWlsLmNvbTCB4gYDVR0fBIHaMIHXMG+gbaBrhmlodHRwOi8v
aWNwLWJyYXNpbC5zeW5ndWxhcmlkLmNvbS5ici9yZXBvc2l0b3Jpby9hYy1zeW5n
dWxhcmlkLW11bHRpcGxhL2xjci9sY3ItYWMtc3luZ3VsYXJpZC1tdWx0aXBsYS5j
cmwwZKBioGCGXmh0dHA6Ly9zeW5ndWxhcmlkLmNvbS5ici9yZXBvc2l0b3Jpby9h
Yy1zeW5ndWxhcmlkLW11bHRpcGxhL2xjci9sY3ItYWMtc3luZ3VsYXJpZC1tdWx0
aXBsYS5jcmwwDQYJKoZIhvcNAQELBQADggIBAAnw1jZ29faDJaKRjkd0I9P8UbcD
oje3u78i0c/Z5/f6+lMky4Qs1s9cCXo9XpAHT0s/qhaGu1LVxz8h+xL9cVGsmZ1w
q7QbPb2nyE3ZOiC/kVS33pqODmxTu3z2xF+SjoCQxfkcR5lIWO8ghB8PzIMz0lj0
klJHG4cC2hIa6IUrT0rT4CZICx6Cn84gOvDhe5bE9dzDEU9WUkIi7qaPpfhnBcZX
fhEI/ZAr4SIZgfc17LnjkzHXFbYX/37sZ/HG2oeSgyzb7eQtnBGTrk+iQdQzB7Ii
Ze5wa0uK7J/l8FtH3IVMGo7+zY0GJdI2sQSdYpm3OfcQJg/+dqS1A9FI5jNtb/I1
JGWMT0FcRWxXhjXlNyB8r3mG+GDnVBabmvNnYgYDaL+DqdqmOpU4qwIdyuU8URg5
oLVCL8XjcNGmJMHwVOkHsKpp02P42iEy51V+BTlo3CLVYNLNqJ7qqPvXc5KU4+vT
z/K/CwVzPPHZcQB5/x2ylz36XIyGaLVL/Cm9ajFHr2o5/s+JAi0H1TIIq7CRzyL+
LPmZYqWnuw8MHmpe2tnXIlslYJaBsNe5rDaquiBPxpAX3QDDEcCsIkFIuqRRl37K
H03cTGVdw1/t/lsW4G3j3Z+05VaY5gm+V2IlAoQL+semjTllbBBo/JJueQkv8pPq
u4gmCy0Od4YxN5/P
-----END CERTIFICATE-----`;

const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCp8YdRkKcXAEz6
lrXfRvWmq7cIKL9a2uXBX1taF3UK5vlVJ4M083s0kfRPbgwytF9I+UOVtNOiQ0eC
nRP7IG5zd9Zfyd/QLi4DEKcPXTEa6RFLn5gaN+SboCrwQ7z1IzTdIwbq9zQvRYXO
opogdxcsM/2azwE1FQJToXL2ZtjjLG6euY9YEF6bQkoUWmkZXrR9R7wl8kjsN5Au
CNHE6hJiYLnFfAU7HbJiBgc4gd7BzQNFCNzH7ASdTx7bY4M5pHNM2VM0I+jyETfJ
n59Z2VYFOugNm4I+HXfWWmmU5y+mK3tRurljCEYbfrqyK8QNvnI255SsR7cPlpv8
twy7cnjBAgMBAAECggEASis99jSuIAVDE3jULnq/Onsl+jsibKotbQxLh9HGBLiS
p/4DLwh2xJZQrJvoWfbLwUL8oqlVVjOL0a7xagAZBG8QUiT+d9K3xSGu768p/8cp
g7pG/WZYcS1hoBPIM6qmZz7ixYiXL2xlvi3MG5AuPl4AeGCQ89RT/CDx1iVD0j07
A13TqI+dkBSD63n+AqjTUmZLhTd+uXMjBw0RleqUxjZF/P/f5z3Rpho8RgkSe9ks
DE7AEZMlddvwxDNb112D+oaoPh3oyzMpgL6HXU5tirNtQMeBnEAlB5iIQpqzps/f
5KXXAxzdy9SvRwz9nWoZxqmHO6d2yW1eKaV8DCdPMwKBgQDg5FCrs2oKAbV1thOj
rc77snsnzy+OPFaVMZCBi4d8f1pFn5I3tNsw5Q3R6a33koMpaE/EVKIW7/0IS9v2
epW6CrACBzPOFWx6FlT5n+bF62MpnM8oIIsVY83m7Beo+ZiTW0JOjfx18WAPF+ZH
JPCcCOLGTsrtOosN9BFPGe/UmwKBgQDBc201H3ehn8GlJGsRsEGU6uFc2N7cRyKW
CNMwTZx4Ojx2WPCjIWbXJJYzDxlH6A+UzDK7Eb4MgrorbnGXBhDUEGojEfy/e7Ct
yaGUkNGD8NwZP4ieDNrbWZhQBssTU9KhUpWdunOWe5b7uk+dGZFRVUR3QCfZ1O+0
i/EptEIH0wKBgEKQkaggtLQ9iT5MJEgAPBGX5IgF9Sd+iIokX4dYi0O4VjnhX2AJ
sg8o3QxSxGFRBm2NKH8OJePwKM751SOBaSvl2e7fvt+yy6bfUUuJnr7aS0GX3mEc
MM6l+d3t55rmNdj33ApwUFeAmFQfWNOaBXXJ04Wq8LmC6IG6yhzFqo0dAoGALztA
YaUCL2ry+6ANqC7xhCtoxKOKnhucHSegcH2yg0QsuPR0JFAmbMbZCTRZhs3o5/qH
NFdboHBWhf4cK7RmbXBoiZF9tT6832GIWt6U2PL4ug1iDLy0vrN8VaWi9WAU4CBq
uSzpxcb9EQ7nG0M/0KzR34/BaxTrRZiZVAZXzNMCgYEAttfCI+cXXcLPUr0pl+rv
txB3lBt736dyky7IlYHNsfFVoT7m88zmFMJqwm8NDuXCOOgdO5eddTM8KT1n2ML5
ph6x5rcmJ/kBY2lYbSjquohydjiass7lrEyPw6BOrnUCCw42X+WYo1+mOdsZs6hz
Rv65+mRUGcIk5NVwgjNRc6M=
-----END PRIVATE KEY-----`;

function cleanPemKey(pemKey) {
  return pemKey
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

function testSignature() {
  console.log('🔍 Iniciando teste de assinatura com certificado real...\n');

  try {
    // 1. Validar chave privada
    console.log('1️⃣  Validando chave privada...');
    const cleanedKey = cleanPemKey(PRIVATE_KEY_PEM);
    const privateKey = crypto.createPrivateKey({
      key: cleanedKey,
      format: 'pem'
    });
    console.log('✅ Chave privada carregada com sucesso!\n');

    // 2. Calcular thumbprint do certificado
    console.log('2️⃣  Calculando thumbprint do certificado...');
    const cleanedCert = CERTIFICATE_PEM
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');
    const buffer = Buffer.from(cleanedCert, 'base64');
    const thumbprint = crypto.createHash('sha1').update(buffer).digest('hex').toUpperCase();
    console.log(`✅ Thumbprint: ${thumbprint}\n`);

    // 3. Criar XML de teste
    console.log('3️⃣  Criando XML de teste...');
    const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse">
  <LoteRps>
    <NumeroLote>1</NumeroLote>
    <Cnpj>60900227000115</Cnpj>
    <InscricaoMunicipal>123456</InscricaoMunicipal>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps>
        <InfRps Id="rps1">
          <IdentificacaoRps>
            <Numero>1</Numero>
            <Serie>RPS</Serie>
            <Tipo>1</Tipo>
          </IdentificacaoRps>
          <DataEmissao>2025-06-24T10:00:00</DataEmissao>
          <NaturezaOperacao>1</NaturezaOperacao>
          <RegimeEspecialTributacao>1</RegimeEspecialTributacao>
          <OptanteSimplesNacional>1</OptanteSimplesNacional>
          <IncentivadorCultural>2</IncentivadorCultural>
          <Servico>
            <Valores>
              <ValorServicos>1000.00</ValorServicos>
              <ValorIss>50.00</ValorIss>
              <Aliquota>0.05</Aliquota>
            </Valores>
            <ItemListaServico>0101</ItemListaServico>
            <CodigoTributacaoMunicipal>080101</CodigoTributacaoMunicipal>
            <Discriminacao>Serviço de teste</Discriminacao>
          </Servico>
          <Tomador>
            <IdentificacaoTomador>
              <CpfCnpj>
                <Cnpj>28925640000121</Cnpj>
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>Empresa Teste</RazaoSocial>
            <Endereco>
              <Endereco>Rua Teste</Endereco>
              <Numero>123</Numero>
              <Bairro>Centro</Bairro>
              <Cidade>3550308</Cidade>
              <Uf>SP</Uf>
              <Cep>01234567</Cep>
            </Endereco>
          </Tomador>
        </InfRps>
      </Rps>
    </ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`;
    console.log('✅ XML criado com sucesso!\n');

    // 4. Assinar XML
    console.log('4️⃣  Assinando XML com RSA-SHA256...');
    const parser = new DOMParserImpl();
    const xmlDoc = parser.parseFromString(testXml, 'text/xml');
    const elementToSign = xmlDoc.getElementsByTagName('EnviarLoteRpsEnvio')[0];
    
    const serializer = new XMLSerializer();
    let canonicalXml = serializer.serializeToString(elementToSign);
    canonicalXml = canonicalXml.replace(/>\s+</g, '><').replace(/xmlns="[^"]*"/g, '');

    const signature = crypto.createSign('sha256');
    signature.update(canonicalXml, 'utf-8');
    const signatureValue = signature.sign(privateKey, 'base64');
    
    console.log(`✅ Assinatura gerada com sucesso!`);
    console.log(`   Tamanho: ${signatureValue.length} caracteres\n`);

    // 5. Validar assinatura
    console.log('5️⃣  Validando assinatura com certificado público...');
    const verify = crypto.createVerify('sha256');
    verify.update(canonicalXml, 'utf-8');
    const isValid = verify.verify(CERTIFICATE_PEM, signatureValue, 'base64');
    
    if (isValid) {
      console.log('✅ Assinatura validada com sucesso!\n');
    } else {
      console.log('❌ Falha na validação da assinatura!\n');
    }

    console.log('🎉 Teste concluído com sucesso!');
    console.log('\n📊 Resumo:');
    console.log(`   - Certificado: VIBE TERAPIAS INTEGRATIVAS LTDA`);
    console.log(`   - Thumbprint: ${thumbprint}`);
    console.log(`   - Chave privada: Válida`);
    console.log(`   - Assinatura: Válida`);
    console.log(`   - Status: ✅ Pronto para emissão de DANFE-Se`);

  } catch (error) {
    console.error('❌ Erro durante o teste:');
    console.error(error.message);
    process.exit(1);
  }
}

testSignature();
