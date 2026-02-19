'use client';

import { motion } from 'framer-motion';
import { Phone, Mail, MapPin, Clock, MessageCircle, Send } from 'lucide-react';
import { MaxIcon } from '@/components/icons/MaxIcon';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import Link from 'next/link';

export default function ContactPage() {
  return (
    <div className="min-h-screen pt-24 bg-bg-secondary">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center space-y-6"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-orbitron font-bold text-content-primary">
              Свяжитесь с{' '}
              <span className="text-poison-green">нами</span>
            </h1>
            <p className="text-xl text-content-secondary max-w-3xl mx-auto leading-relaxed">
              Мы всегда готовы ответить на ваши вопросы и помочь решить любую задачу по санитарной безопасности
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-20 bg-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Cards */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              {/* Phone */}
              <CyberpunkCard className="p-6">
                <div className="flex items-center space-x-6">
                  <div className="w-12 h-12 bg-poison-green/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-poison-green" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-orbitron font-semibold text-content-primary mb-2">
                      Телефон
                    </h3>
                    <a 
                      href="tel:+79883313332" 
                      className="text-xl font-bold text-poison-green hover:text-neon-orange transition-colors"
                    >
                      8-988-331-33-32
                    </a>
                    <p className="text-sm text-content-muted mt-1">Круглосуточно</p>
                  </div>
                </div>
              </CyberpunkCard>

              {/* Email */}
              <CyberpunkCard className="p-6">
                <div className="flex items-center space-x-6">
                  <div className="w-12 h-12 bg-neon-orange/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-neon-orange" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-orbitron font-semibold text-content-primary mb-2">
                      Email
                    </h3>
                    <a 
                      href="mailto:deztexug@yandex.ru" 
                      className="text-xl font-bold text-neon-orange hover:text-poison-green transition-colors"
                    >
                      deztexug@yandex.ru
                    </a>
                    <p className="text-sm text-content-muted mt-1 leading-relaxed">Ответ в течение 30 мин</p>
                  </div>
                </div>
              </CyberpunkCard>

              {/* Address */}
              <CyberpunkCard className="p-6">
                <div className="flex items-center space-x-6">
                  <div className="w-12 h-12 bg-cyber-blue/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-cyber-blue" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-orbitron font-semibold text-content-primary mb-2">
                      Адрес офиса
                    </h3>
                    <p className="text-lg font-medium text-content-primary">
                      г. Новороссийск, ул. Леднева, д. 5Б
                    </p>
                    <p className="text-sm text-content-muted">пом. № 2,3,6,10</p>
                    <p className="text-sm text-content-muted mt-1 leading-relaxed">Выезд по всему Краснодарскому краю</p>
                  </div>
                </div>
              </CyberpunkCard>

              {/* Working Hours */}
              <CyberpunkCard className="p-6">
                <div className="flex items-center space-x-6">
                  <div className="w-12 h-12 bg-electric-blue/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-electric-blue" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-orbitron font-semibold text-content-primary mb-2">
                      Режим работы
                    </h3>
                    <p className="text-lg font-medium text-content-primary">
                      Круглосуточно
                    </p>
                    <p className="text-sm text-content-muted mt-1 leading-relaxed">Без выходных и праздников</p>
                  </div>
                </div>
              </CyberpunkCard>
            </motion.div>

            {/* Messengers */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-orbitron font-bold text-content-primary mb-6">
                Свяжитесь через{' '}
                <span className="text-poison-green">мессенджеры</span>
              </h2>

              {/* WhatsApp */}
              <CyberpunkCard className="p-6 group hover:border-green-500 transition-all">
                <Link 
                  href="https://wa.me/79883194352" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-6"
                >
                  <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-green-500/20 transition-colors">
                    <MessageCircle className="w-6 h-6 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-orbitron font-semibold text-content-primary mb-1">
                      WhatsApp
                    </h3>
                    <p className="text-content-secondary leading-relaxed">Напишите нам в WhatsApp</p>
                  </div>
                </Link>
              </CyberpunkCard>

              {/* Telegram */}
              <CyberpunkCard className="p-6 group hover:border-blue-400 transition-all">
                <Link 
                  href="https://t.me/DEZTEAM" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-6"
                >
                  <div className="w-12 h-12 bg-blue-400/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-400/20 transition-colors">
                    <Send className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-orbitron font-semibold text-content-primary mb-1">
                      Telegram
                    </h3>
                    <p className="text-content-secondary leading-relaxed">@DEZTEAM</p>
                  </div>
                </Link>
              </CyberpunkCard>

              {/* MAX */}
              <CyberpunkCard className="p-6 group hover:border-purple-500 transition-all">
                <Link 
                  href="https://max.ru/u/f9LHodD0cOKOoy0i--m4zxHSoKBMhEOCW708G26ksoCIINexFW-vr8F-7go" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-6"
                >
                  <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/20 transition-colors">
                    <MaxIcon className="w-6 h-6 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-orbitron font-semibold text-content-primary mb-1">
                      MAX
                    </h3>
                    <p className="text-content-secondary leading-relaxed">Напишите нам в MAX</p>
                  </div>
                </Link>
              </CyberpunkCard>

              {/* CTA Buttons */}
              <div className="pt-6 space-y-4">
                <CyberpunkButton
                  href="/booking"
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  Оформить заявку
                </CyberpunkButton>
                <CyberpunkButton
                  href="tel:+79883313332"
                  variant="secondary"
                  size="lg"
                  className="w-full"
                >
                  Позвонить сейчас
                </CyberpunkButton>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Map Section (Placeholder) */}
      <section className="py-20 bg-bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl md:text-4xl font-orbitron font-bold text-content-primary mb-4">
              Как нас{' '}
              <span className="text-poison-green">найти</span>
            </h2>
            <p className="text-lg text-content-secondary leading-relaxed">
              г. Новороссийск, ул. Леднева, д. 5Б, пом. № 2,3,6,10
            </p>
          </motion.div>
          <CyberpunkCard className="p-8">
            <div className="aspect-video bg-bg-secondary rounded-lg overflow-hidden border-2 border-gray-200">
              <iframe
                src="https://yandex.ru/map-widget/v1/?um=constructor%3A0&lang=ru_RU&scroll=false&zoom=16&ll=37.772990%2C44.724488&pt=37.772990%2C44.724488"
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                style={{ border: 0 }}
                title="Карта офиса ДЕЗТЕХЮГ - г. Новороссийск, ул. Леднева, д. 5Б"
              />
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm font-medium text-content-primary">
                г. Новороссийск, ул. Леднева, д. 5Б, пом. № 2,3,6,10
              </p>
              <a
                href="https://yandex.ru/maps/?pt=37.772990,44.724488&z=16&l=map"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-poison-green hover:text-neon-orange transition-colors mt-2 inline-block"
              >
                Открыть в Яндекс.Картах
              </a>
            </div>
          </CyberpunkCard>
        </div>
      </section>
    </div>
  );
}

