---
diagram: class-inventory
uml-type: inventory
source: class-domain.md, class-application.md, class-infra-presentation.md; EDD.md §4.5.2 Class Inventory Table
generated: 2026-04-26T00:00:00Z
---

# Class Inventory — All Layers

> 來源：Parsed from class-domain.md, class-application.md, class-infra-presentation.md; EDD.md §4.5.2 Class Inventory Table

## Domain Layer

| Class | Stereotype | Layer | src/ Path | Test Path | Test ID |
|-------|-----------|-------|-----------|-----------|---------|
| `SymbolId` | `<<enumeration>>` | Domain / Enum | `src/domain/value-objects/Symbol.ts` | `tests/unit/domain/value-objects/Symbol.test.ts` | TC-UNIT-SYMBOLID |
| `CoinTossResult` | `<<enumeration>>` | Domain / Enum | `src/domain/value-objects/CoinTossResult.ts` | `tests/unit/domain/value-objects/CoinTossResult.test.ts` | TC-UNIT-COINTOSSRESULT |
| `FGMultiplier` | `<<enumeration>>` | Domain / Enum | `src/domain/value-objects/FGMultiplier.ts` | `tests/unit/domain/value-objects/FGMultiplier.test.ts` | TC-UNIT-FGMULTIPLIER |
| `FGBonusMultiplier` | `<<enumeration>>` | Domain / Enum | `src/domain/value-objects/FGBonusMultiplier.ts` | `tests/unit/domain/value-objects/FGBonusMultiplier.test.ts` | TC-UNIT-FGBONUSMULTIPLIER |
| `Currency` | `<<enumeration>>` | Domain / Enum | `src/domain/value-objects/Currency.ts` | `tests/unit/domain/value-objects/Currency.test.ts` | TC-UNIT-CURRENCY |
| `SpinScenario` | `<<enumeration>>` | Domain / Enum | `src/domain/value-objects/SpinScenario.ts` | `tests/unit/domain/value-objects/SpinScenario.test.ts` | TC-UNIT-SPINSCENARIO |
| `Position` | `<<ValueObject>>` | Domain | `src/domain/value-objects/Position.ts` | `tests/unit/domain/value-objects/Position.test.ts` | TC-UNIT-POSITION |
| `Grid` | `<<ValueObject>>` | Domain | `src/domain/entities/Grid.ts` | `tests/unit/domain/entities/Grid.test.ts` | TC-UNIT-GRID |
| `WinLine` | `<<ValueObject>>` | Domain | `src/domain/value-objects/WinLine.ts` | `tests/unit/domain/value-objects/WinLine.test.ts` | TC-UNIT-WINLINE |
| `LightningMarkSet` | `<<ValueObject>>` | Domain | `src/domain/value-objects/LightningMarkSet.ts` | `tests/unit/domain/value-objects/LightningMarkSet.test.ts` | TC-UNIT-LIGHTNINGMARKSET |
| `CascadeStep` | `<<ValueObject>>` | Domain | `src/domain/entities/CascadeStep.ts` | `tests/unit/domain/entities/CascadeStep.test.ts` | TC-UNIT-CASCADESTEP |
| `CascadeSequence` | `<<ValueObject>>` | Domain | `src/domain/entities/CascadeSequence.ts` | `tests/unit/domain/entities/CascadeSequence.test.ts` | TC-UNIT-CASCADESEQUENCE |
| `ThunderBlessingResult` | `<<ValueObject>>` | Domain | `src/domain/value-objects/ThunderBlessingResult.ts` | `tests/unit/domain/value-objects/ThunderBlessingResult.test.ts` | TC-UNIT-THUNDERBLESSINGRESULT |
| `CoinTossConfig` | `<<ValueObject>>` | Domain | `src/domain/value-objects/CoinTossConfig.ts` | `tests/unit/domain/value-objects/CoinTossConfig.test.ts` | TC-UNIT-COINTOSSCONFIG |
| `NearMissConfig` | `<<ValueObject>>` | Domain | `src/domain/value-objects/NearMissConfig.ts` | `tests/unit/domain/value-objects/NearMissConfig.test.ts` | TC-UNIT-NEARMISSCONFIG |
| `FGBonusWeight` | `<<ValueObject>>` | Domain | `src/domain/value-objects/FGBonusWeight.ts` | `tests/unit/domain/value-objects/FGBonusWeight.test.ts` | TC-UNIT-FGBONUSWEIGHT |
| `SymbolDefinition` | `<<ValueObject>>` | Domain | `src/domain/value-objects/SymbolDefinition.ts` | `tests/unit/domain/value-objects/SymbolDefinition.test.ts` | TC-UNIT-SYMBOLDEFINITION |
| `Payline` | `<<ValueObject>>` | Domain | `src/domain/value-objects/Payline.ts` | `tests/unit/domain/value-objects/Payline.test.ts` | TC-UNIT-PAYLINE |
| `GameConfig` | `<<ValueObject>>` | Domain / Config | `src/config/GameConfig.generated.ts` | `tests/unit/config/GameConfig.test.ts` | TC-UNIT-GAMECONFIG |
| `FGRound` | `<<Entity>>` | Domain | `src/domain/entities/FGRound.ts` | `tests/unit/domain/entities/FGRound.test.ts` | TC-UNIT-FGROUND |
| `FreeGameSession` | `<<Entity>>` | Domain | `src/domain/entities/FreeGameSession.ts` | `tests/unit/domain/entities/FreeGameSession.test.ts` | TC-UNIT-FREEGAMESESSION |
| `SpinEntity` | `<<Entity>>` | Domain | `src/domain/entities/SpinEntity.ts` | `tests/unit/domain/entities/SpinEntity.test.ts` | TC-UNIT-SPINENTITY |
| `PlayerWallet` | `<<Entity>>` | Domain | `src/domain/entities/PlayerWallet.ts` | `tests/unit/domain/entities/PlayerWallet.test.ts` | TC-UNIT-PLAYERWALLET |
| `SpinStarted` | `<<DomainEvent>>` | Domain | `src/domain/events/SpinStarted.ts` | `tests/unit/domain/events/SpinStarted.test.ts` | TC-UNIT-SPINSTARTED |
| `CascadeStepCompleted` | `<<DomainEvent>>` | Domain | `src/domain/events/CascadeStepCompleted.ts` | `tests/unit/domain/events/CascadeStepCompleted.test.ts` | TC-UNIT-CASCADESTEPCOMPLETED |
| `ThunderBlessingTriggered` | `<<DomainEvent>>` | Domain | `src/domain/events/ThunderBlessingTriggered.ts` | `tests/unit/domain/events/ThunderBlessingTriggered.test.ts` | TC-UNIT-THUNDERBLESSINGTRIGGERED |
| `CoinTossResolved` | `<<DomainEvent>>` | Domain | `src/domain/events/CoinTossResolved.ts` | `tests/unit/domain/events/CoinTossResolved.test.ts` | TC-UNIT-COINTOSSRESOLVED |
| `SpinCompleted` | `<<DomainEvent>>` | Domain | `src/domain/events/SpinCompleted.ts` | `tests/unit/domain/events/SpinCompleted.test.ts` | TC-UNIT-SPINCOMPLETED |
| `SlotEngine` | `<<DomainService>>` | Domain | `src/domain/engine/SlotEngine.ts` | `tests/unit/domain/engine/SlotEngine.test.ts` | TC-UNIT-SLOTENGINE |
| `CascadeEngine` | `<<DomainService>>` | Domain | `src/domain/engine/CascadeEngine.ts` | `tests/unit/domain/engine/CascadeEngine.test.ts` | TC-UNIT-CASCADEENGINE |
| `ThunderBlessingHandler` | `<<DomainService>>` | Domain | `src/domain/engine/ThunderBlessingHandler.ts` | `tests/unit/domain/engine/ThunderBlessingHandler.test.ts` | TC-UNIT-THUNDERBLESSINGHANDLER |
| `CoinTossEvaluator` | `<<DomainService>>` | Domain | `src/domain/engine/CoinTossEvaluator.ts` | `tests/unit/domain/engine/CoinTossEvaluator.test.ts` | TC-UNIT-COINTOSSEVALUATOR |
| `FreeGameOrchestrator` | `<<DomainService>>` | Domain | `src/domain/engine/FreeGameOrchestrator.ts` | `tests/unit/domain/engine/FreeGameOrchestrator.test.ts` | TC-UNIT-FREEGAMEORCHESTRATOR |
| `NearMissSelector` | `<<DomainService>>` | Domain | `src/domain/engine/NearMissSelector.ts` | `tests/unit/domain/engine/NearMissSelector.test.ts` | TC-UNIT-NEARMSISELECTOR |
| `IWalletRepository` | `<<Repository>>` | Domain / Port | `src/domain/ports/IWalletRepository.ts` | `tests/unit/domain/ports/IWalletRepository.test.ts` | TC-UNIT-IWALLETREPOSITORY |
| `ISessionRepository` | `<<Repository>>` | Domain / Port | `src/domain/ports/ISessionRepository.ts` | `tests/unit/domain/ports/ISessionRepository.test.ts` | TC-UNIT-ISESSIONREPOSITORY |
| `ISessionCache` | `<<Repository>>` | Domain / Port | `src/domain/ports/ISessionCache.ts` | `tests/unit/domain/ports/ISessionCache.test.ts` | TC-UNIT-ISESSIONCACHE |

## Application Layer

| Class | Stereotype | Layer | src/ Path | Test Path | Test ID |
|-------|-----------|-------|-----------|-----------|---------|
| `SpinRequest` | `<<DTO>>` | Application | `src/application/dto/SpinRequest.ts` | `tests/unit/application/dto/SpinRequest.test.ts` | TC-UNIT-SPINREQUEST |
| `BuyFeatureRequest` | `<<DTO>>` | Application | `src/application/dto/BuyFeatureRequest.ts` | `tests/unit/application/dto/BuyFeatureRequest.test.ts` | TC-UNIT-BUYFEATUREREQUEST |
| `SpinResponse` | `<<DTO>>` | Application | `src/application/dto/SpinResponse.ts` | `tests/unit/application/dto/SpinResponse.test.ts` | TC-UNIT-SPINRESPONSE |
| `FullSpinOutcomeDTO` | `<<DTO>>` | Application | `src/application/dto/FullSpinOutcomeDTO.ts` | `tests/unit/application/dto/FullSpinOutcomeDTO.test.ts` | TC-UNIT-FULLSPINOUTCOMEDTO |
| `CascadeStepDTO` | `<<DTO>>` | Application | `src/application/dto/CascadeStepDTO.ts` | `tests/unit/application/dto/CascadeStepDTO.test.ts` | TC-UNIT-CASCADESTEPDTO |
| `WinLineDTO` | `<<DTO>>` | Application | `src/application/dto/WinLineDTO.ts` | `tests/unit/application/dto/WinLineDTO.test.ts` | TC-UNIT-WINLINEDTO |
| `PositionDTO` | `<<DTO>>` | Application | `src/application/dto/PositionDTO.ts` | `tests/unit/application/dto/PositionDTO.test.ts` | TC-UNIT-POSITIONDTO |
| `FGRoundDTO` | `<<DTO>>` | Application | `src/application/dto/FGRoundDTO.ts` | `tests/unit/application/dto/FGRoundDTO.test.ts` | TC-UNIT-FGROUNDDTO |
| `SessionStateDTO` | `<<DTO>>` | Application | `src/application/dto/SessionStateDTO.ts` | `tests/unit/application/dto/SessionStateDTO.test.ts` | TC-UNIT-SESSIONSTATEDTO |
| `BaseUseCase` | `<<abstract>>` | Application | `src/application/use-cases/BaseUseCase.ts` | `tests/unit/application/use-cases/BaseUseCase.test.ts` | TC-UNIT-BASEUSECASE |
| `SpinUseCase` | `<<ApplicationService>>` | Application | `src/application/use-cases/SpinUseCase.ts` | `tests/unit/application/use-cases/SpinUseCase.test.ts` | TC-UNIT-SPINUSECASE |
| `BuyFeatureUseCase` | `<<ApplicationService>>` | Application | `src/application/use-cases/BuyFeatureUseCase.ts` | `tests/unit/application/use-cases/BuyFeatureUseCase.test.ts` | TC-UNIT-BUYFEATUREUSECASE |
| `GetSessionStateUseCase` | `<<ApplicationService>>` | Application | `src/application/use-cases/GetSessionStateUseCase.ts` | `tests/unit/application/use-cases/GetSessionStateUseCase.test.ts` | TC-UNIT-GETSESSIONSTATEUSECASE |
| `SessionFloorGuard` | `<<ApplicationService>>` | Application | `src/application/guards/SessionFloorGuard.ts` | `tests/unit/application/guards/SessionFloorGuard.test.ts` | TC-UNIT-SESSIONFLOORGUARD |
| `ConcurrencyLockGuard` | `<<ApplicationService>>` | Application | `src/application/guards/ConcurrencyLockGuard.ts` | `tests/unit/application/guards/ConcurrencyLockGuard.test.ts` | TC-UNIT-CONCURRENCYLOCKGUARD |
| `ILogger` | `<<interface>>` | Application | `src/application/interfaces/ILogger.ts` | `tests/unit/application/interfaces/ILogger.test.ts` | TC-UNIT-ILOGGER |

## Infrastructure Layer

| Class | Stereotype | Layer | src/ Path | Test Path | Test ID |
|-------|-----------|-------|-----------|-----------|---------|
| `SupabaseWalletRepository` | `<<InfrastructureAdapter>>` | Infrastructure | `src/infrastructure/repositories/SupabaseWalletRepository.ts` | `tests/unit/infrastructure/repositories/SupabaseWalletRepository.test.ts` | TC-UNIT-SUPABASEWALLETREPOSITORY |
| `SupabaseSessionRepository` | `<<InfrastructureAdapter>>` | Infrastructure | `src/infrastructure/repositories/SupabaseSessionRepository.ts` | `tests/unit/infrastructure/repositories/SupabaseSessionRepository.test.ts` | TC-UNIT-SUPABASESESSIONREPOSITORY |
| `UpstashCacheAdapter` | `<<InfrastructureAdapter>>` | Infrastructure | `src/infrastructure/cache/UpstashCacheAdapter.ts` | `tests/unit/infrastructure/cache/UpstashCacheAdapter.test.ts` | TC-UNIT-UPSTASHCACHEADAPTER |
| `RedisSessionCache` | `<<InfrastructureAdapter>>` | Infrastructure | `src/infrastructure/cache/RedisSessionCache.ts` | `tests/unit/infrastructure/cache/RedisSessionCache.test.ts` | TC-UNIT-REDISSESSIONCACHE |
| `SupabaseAuthAdapter` | `<<InfrastructureAdapter>>` | Infrastructure | `src/infrastructure/auth/SupabaseAuthAdapter.ts` | `tests/unit/infrastructure/auth/SupabaseAuthAdapter.test.ts` | TC-UNIT-SUPABASEAUTHADAPTER |
| `IAuthProvider` | `<<interface>>` | Infrastructure / Port | `src/infrastructure/auth/IAuthProvider.ts` | `tests/unit/infrastructure/auth/IAuthProvider.test.ts` | TC-UNIT-IAUTHPROVIDER |
| `PlayerClaims` | `<<DTO>>` | Infrastructure | `src/infrastructure/auth/PlayerClaims.ts` | `tests/unit/infrastructure/auth/PlayerClaims.test.ts` | TC-UNIT-PLAYERCLAIMS |
| `SessionState` | `<<DTO>>` | Infrastructure | `src/infrastructure/dto/SessionState.ts` | `tests/unit/infrastructure/dto/SessionState.test.ts` | TC-UNIT-SESSIONSTATE |

## Presentation Layer

| Class | Stereotype | Layer | src/ Path | Test Path | Test ID |
|-------|-----------|-------|-----------|-----------|---------|
| `SpinRequestDTO` | `<<DTO>>` | Presentation | `src/interface/dto/SpinRequest.dto.ts` | `tests/unit/interface/dto/SpinRequest.dto.test.ts` | TC-UNIT-SPINREQUESTDTO |
| `SpinResponseDTO` | `<<DTO>>` | Presentation | `src/interface/dto/SpinResponse.dto.ts` | `tests/unit/interface/dto/SpinResponse.dto.test.ts` | TC-UNIT-SPINRESPONSEDTO |
| `FullSpinOutcomeDTO` | `<<DTO>>` | Presentation | `src/interface/dto/FullSpinOutcome.dto.ts` | `tests/unit/interface/dto/FullSpinOutcome.dto.test.ts` | TC-UNIT-FULLSPINOUTCOMEDTO-P |
| `FGRoundDTO` | `<<DTO>>` | Presentation | `src/interface/dto/FGRound.dto.ts` | `tests/unit/interface/dto/FGRound.dto.test.ts` | TC-UNIT-FGROUNDDTO-P |
| `ErrorResponseDTO` | `<<DTO>>` | Presentation | `src/interface/dto/ErrorResponse.dto.ts` | `tests/unit/interface/dto/ErrorResponse.dto.test.ts` | TC-UNIT-ERRORRESPONSEDTO |
| `gameController` | `<<PresentationAdapter>>` | Presentation | `src/interface/routes/spin.route.ts` | `tests/unit/interface/routes/spin.route.test.ts` | TC-UNIT-GAMECONTROLLER |
| `healthController` | `<<PresentationAdapter>>` | Presentation | `src/interface/routes/health.route.ts` | `tests/unit/interface/routes/health.route.test.ts` | TC-UNIT-HEALTHCONTROLLER |
| `JwtAuthGuard` | `<<PresentationAdapter>>` | Presentation | `src/interface/auth/JwtAuthGuard.ts` | `tests/unit/interface/auth/JwtAuthGuard.test.ts` | TC-UNIT-JWTAUTHGUARD |
| `DomainErrorMapper` | `<<PresentationAdapter>>` | Presentation | `src/interface/error-mappers/DomainErrorMapper.ts` | `tests/unit/interface/error-mappers/DomainErrorMapper.test.ts` | TC-UNIT-DOMAINERRORMAPPER |

## Summary Statistics

| Layer | Class Count | Enum Count | Interface Count | Total |
|-------|------------|-----------|----------------|-------|
| Domain (Value Objects) | 10 | 6 | 0 | 16 |
| Domain (Entities) | 4 | 0 | 0 | 4 |
| Domain (Domain Events) | 5 | 0 | 0 | 5 |
| Domain (Services) | 6 | 0 | 0 | 6 |
| Domain (Ports) | 0 | 0 | 3 | 3 |
| Application (DTOs) | 9 | 0 | 1 | 10 |
| Application (Use Cases / Guards) | 5 | 0 | 0 | 5 |
| Infrastructure | 5 | 0 | 2 | 7 |
| Presentation | 9 | 0 | 0 | 9 |
| **TOTAL** | **53** | **6** | **6** | **65** |

## Diagram Source Map

| File | Diagram Type | Classes Defined |
|------|-------------|----------------|
| `docs/diagrams/class-domain.md` | Class (Domain Layer) | Grid, CascadeStep, CascadeSequence, LightningMarkSet, FGRound, FreeGameSession, SpinEntity, PlayerWallet, GameConfig, SlotEngine, CascadeEngine, ThunderBlessingHandler, CoinTossEvaluator, FreeGameOrchestrator, NearMissSelector, IWalletRepository, ISessionRepository, ISessionCache + 6 enums + 5 domain events + value objects |
| `docs/diagrams/class-application.md` | Class (Application Layer) | BaseUseCase, SpinUseCase, BuyFeatureUseCase, GetSessionStateUseCase, SessionFloorGuard, ConcurrencyLockGuard, SpinRequest, BuyFeatureRequest, SpinResponse, FullSpinOutcomeDTO, CascadeStepDTO, WinLineDTO, PositionDTO, FGRoundDTO, SessionStateDTO |
| `docs/diagrams/class-infra-presentation.md` | Class (Infra + Presentation) | SupabaseWalletRepository, SupabaseSessionRepository, UpstashCacheAdapter, RedisSessionCache, SupabaseAuthAdapter, IAuthProvider, PlayerClaims, SessionState, SpinRequestDTO, SpinResponseDTO, FullSpinOutcomeDTO, FGRoundDTO, ErrorResponseDTO, gameController, healthController, JwtAuthGuard, DomainErrorMapper |
