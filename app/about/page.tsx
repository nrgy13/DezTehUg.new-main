'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Award, Users, Target, Clock, Zap } from 'lucide-react';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import AnimatedIcon from '@/components/AnimatedIcon';

const teamMembers = [
  {
    name: 'Денисов Юрий',
    role: 'Старший дезинфектор',
    experience: '8 лет опыта',
    specialization: 'Дезинфекция и дезинсекция',
    icon: Shield,
  },
  {
    name: 'Ананьева Регина',
    role: 'Руководитель отдела продаж',
    experience: '6 лет опыта',
    specialization: 'Дезинсекция и дератизация',
    icon: Award,
  },
  {
    name: 'Алексей Петров',
    role: 'Главный технолог',
    experience: '12 лет опыта',
    specialization: 'Анализ воды и лабораторные исследования',
    icon: Target,
  },
];

const achievements = [
  {
    title: 'Более 1500 объектов обработано',
    description: 'Жилые дома, офисы, медучреждения, производства',
    icon: Users,
    animationName: 'city.json',
    color: 'text-neon-orange',
  },
  {
    title: '99.9% эффективность обработки',
    description: 'Подтверждено лабораторными исследованиями',
    icon: Target,
    animationName: 'target.json',
    color: 'text-poison-green',
  },
  {
    title: 'Лицензированная деятельность',
    description: 'Полное соответствие требованиям Роспотребнадзора',
    icon: Award,
    animationName: 'patent.json',
    color: 'text-cyber-blue',
  },
  {
    title: '24/7 экстренная служба',
    description: 'Круглосуточная готовность к выезду',
    icon: Clock,
    animationName: 'alert.json',
    color: 'text-red-500',
  },
];

const values = [
  {
    title: 'Инновации',
    description: 'Используем только современные технологии и препараты последнего поколения',
    icon: Zap,
    animationName: 'dropper.json',
    color: 'text-poison-green',
  },
  {
    title: 'Безопасность',
    description: 'Все препараты сертифицированы и безопасны для людей и животных',
    icon: Shield,
    animationName: 'shield.json',
    color: 'text-poison-green',
  },
  {
    title: 'Результат',
    description: 'Гарантируем 100% уничтожение вредителей с письменной гарантией',
    icon: Target,
    animationName: 'goals.json',
    color: 'text-poison-green',
  },
  {
    title: 'Профессионализм',
    description: 'Команда лицензированных специалистов с многолетним опытом',
    icon: Award,
    animationName: 'certificate (1).json',
    color: 'text-poison-green',
  },
];

export default function AboutPage() {
  const [achievementsHoveredIndex, setAchievementsHoveredIndex] = useState<number | null>(null);
  const [valuesHoveredIndex, setValuesHoveredIndex] = useState<number | null>(null);
  
  // Обработчики для touch событий с предотвращением конфликтов
  const handleAchievementTouchStart = (index: number) => {
    setAchievementsHoveredIndex(index);
  };
  
  const handleAchievementTouchEnd = () => {
    // Не останавливаем анимацию сразу - даем доиграть до конца цикла
    // Анимация остановится автоматически через useEffect в AnimatedIcon
    // Используем стандартную длительность анимации (обычно 2 секунды)
    setTimeout(() => setAchievementsHoveredIndex(null), 2000);
  };
  
  const handleValueTouchStart = (index: number) => {
    setValuesHoveredIndex(index);
  };
  
  const handleValueTouchEnd = () => {
    // Не останавливаем анимацию сразу - даем доиграть до конца цикла
    // Анимация остановится автоматически через useEffect в AnimatedIcon
    // Используем стандартную длительность анимации (обычно 2 секунды)
    setTimeout(() => setValuesHoveredIndex(null), 2000);
  };

  return (
    <div className="min-h-screen pt-24">
      {/* Mission Section */}
      <section className="py-20 bg-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              {/* Enhanced Title */}
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-orbitron font-bold text-content-primary leading-tight whitespace-nowrap">
                  <span className="relative inline-block">
                    <span className="text-poison-green">Эксперт по санитарной</span>
                    <span className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-poison-green via-neon-orange to-poison-green opacity-50 rounded-full" />
                  </span>{' '}
                  <span className="text-neon-orange">безопасности</span>
                </h2>
              </div>

              {/* Enhanced Text Content */}
              <div className="space-y-6">
                <div className="relative pl-6 border-l-4 border-poison-green/30">
                  <p className="text-xl text-content-primary leading-relaxed font-medium">
                    <span className="text-poison-green font-bold">ДезТех-Юг</span> — эксперт по санитарной безопасности с 5-летним опытом.
                  </p>
                  <p className="text-lg text-content-secondary leading-relaxed mt-3">
                    Мы выполняем полный цикл работ по дезинфекции, дератизации, дезинсекции и анализу воды для объектов любой сложности.
                  </p>
                </div>

                <div className="bg-gradient-to-r from-neon-orange/5 to-poison-green/5 rounded-xl p-6 border border-neon-orange/20">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-neon-orange/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-neon-orange font-bold text-sm">→</span>
                    </div>
                    <div>
                      <p className="text-lg text-content-primary font-semibold mb-2">
                        От морских судов до суши
                      </p>
                      <p className="text-content-secondary leading-relaxed">
                        Рестораны, квартиры, складские комплексы, бизнес-центры и нефтеперерабатывающие заводы.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-bg-secondary rounded-lg border border-gray-200 hover:border-poison-green/50 transition-all">
                    <div className="flex items-center mb-3">
                      <div className="w-8 h-8 rounded-lg bg-poison-green/10 flex items-center justify-center mr-3">
                        <Shield className="w-4 h-4 text-poison-green" />
                      </div>
                      <h3 className="font-semibold text-content-primary">Высокие стандарты</h3>
                    </div>
                    <p className="text-content-secondary leading-relaxed text-sm">
                      Наши команды долгое время обслуживали флот и работали со всеми портами юга России, что сформировало высокие стандарты оперативности и надежности.
                    </p>
                  </div>

                  <div className="p-5 bg-bg-secondary rounded-lg border border-gray-200 hover:border-neon-orange/50 transition-all">
                    <div className="flex items-center mb-3">
                      <div className="w-8 h-8 rounded-lg bg-neon-orange/10 flex items-center justify-center mr-3">
                        <Award className="w-4 h-4 text-neon-orange" />
                      </div>
                      <h3 className="font-semibold text-content-primary">Лицензированная работа</h3>
                    </div>
                    <p className="text-content-secondary leading-relaxed text-sm">
                      Все работы проводим на основании действующих лицензий и регламентов, с использованием профессиональных препаратов и оборудования.
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-poison-green/10 via-transparent to-neon-orange/10 rounded-xl p-6 border-2 border-dashed border-poison-green/20">
                  <p className="text-lg text-content-primary leading-relaxed font-medium text-center">
                    Ценим <span className="text-poison-green font-bold">аккуратность</span>,{' '}
                    <span className="text-neon-orange font-bold">конфиденциальность</span> и{' '}
                    <span className="text-poison-green font-bold">предсказуемый результат</span>
                  </p>
                  <p className="text-content-secondary text-center mt-3 leading-relaxed">
                    Чтобы вы могли спокойно работать в чистой и безопасной среде.
                  </p>
                </div>
              </div>

              <CyberpunkButton 
                href="/services"
                variant="primary"
                size="lg"
                className="group mt-6"
              >
                Наши технологии
                <Zap className="h-5 w-5 ml-2 group-hover:rotate-12 transition-transform" />
              </CyberpunkButton>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative"
            >
              <img
                src="/images/AboutCompany.jpg"
                alt="Команда DEZTECHYUG за работой"
                className="w-full h-[500px] lg:h-[600px] object-cover object-right rounded-lg shadow-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-poison-green/20 via-transparent to-neon-orange/20 rounded-lg" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Achievements Section */}
      <section className="py-20 bg-bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-orbitron font-bold text-content-primary mb-6">
              Наши достижения говорят{' '}
              <span className="text-poison-green">сами за себя</span>
            </h2>
            <p className="text-xl text-content-secondary max-w-3xl mx-auto leading-relaxed">
              За 5 лет работы мы накопили впечатляющую статистику успешных проектов
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {achievements.map((achievement, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <CyberpunkCard 
                  className="text-center p-6 h-full"
                  onMouseEnter={() => setAchievementsHoveredIndex(index)}
                  onMouseLeave={() => setAchievementsHoveredIndex(null)}
                  onTouchStart={() => handleAchievementTouchStart(index)}
                  onTouchEnd={handleAchievementTouchEnd}
                >
                  <AnimatedIcon
                    animationName={achievement.animationName}
                    className={`h-12 w-12 mx-auto mb-4 ${achievement.color}`}
                    isHovered={achievementsHoveredIndex === index}
                  />
                  <h3 className="text-lg font-orbitron font-semibold text-content-primary mb-3">
                    {achievement.title}
                  </h3>
                  <p className="text-content-secondary text-sm">
                    {achievement.description}
                  </p>
                </CyberpunkCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 bg-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-orbitron font-bold text-content-primary mb-6">
              Команда{' '}
              <span className="text-poison-green">профессионалов</span>
            </h2>
            <p className="text-xl text-content-secondary max-w-3xl mx-auto leading-relaxed">
              Каждый специалист нашей команды — эксперт в своей области с многолетним опытом
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {teamMembers.map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <CyberpunkCard className="p-6 text-center">
                  <h3 className="text-xl font-orbitron font-semibold text-content-primary mb-2">
                    {member.name}
                  </h3>
                  <div className="text-neon-orange font-medium mb-2">
                    {member.role}
                  </div>
                  <div className="text-sm text-content-secondary mb-3">
                    {member.experience}
                  </div>
                  <p className="text-sm text-content-muted">
                    {member.specialization}
                  </p>
                </CyberpunkCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-orbitron font-bold text-content-primary mb-6">
              Наши{' '}
              <span className="text-poison-green">принципы работы</span>
            </h2>
            <p className="text-xl text-content-secondary max-w-3xl mx-auto leading-relaxed">
              Четыре основных принципа, которые определяют качество наших услуг
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <CyberpunkCard 
                  className="p-6 h-full"
                  onMouseEnter={() => setValuesHoveredIndex(index)}
                  onMouseLeave={() => setValuesHoveredIndex(null)}
                  onTouchStart={() => handleValueTouchStart(index)}
                  onTouchEnd={handleValueTouchEnd}
                >
                  <div className="flex items-start space-x-4">
                    <div className="p-3 rounded-lg">
                      <AnimatedIcon
                        animationName={value.animationName}
                        className={`h-12 w-12 ${value.color}`}
                        isHovered={valuesHoveredIndex === index}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-orbitron font-semibold text-content-primary mb-3">
                        {value.title}
                      </h3>
                      <p className="text-content-secondary leading-relaxed">
                        {value.description}
                      </p>
                    </div>
                  </div>
                </CyberpunkCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-poison-green/10 via-bg-secondary to-neon-orange/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <h2 className="text-3xl md:text-4xl font-orbitron font-bold text-content-primary">
              Готовы стать частью нашей{' '}
              <span className="text-poison-green">истории успеха</span>?
            </h2>
            <p className="text-xl text-content-secondary leading-relaxed">
              Присоединяйтесь к тысячам довольных клиентов, которые доверили нам защиту своего здоровья и бизнеса
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <CyberpunkButton 
                href="/booking"
                variant="primary"
                size="lg"
                className="pulse-cta"
              >
                Рассчитать стоимость
              </CyberpunkButton>
              <CyberpunkButton 
                href="/contact"
                variant="secondary"
                size="lg"
              >
                Связаться с нами
              </CyberpunkButton>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}