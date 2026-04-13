
import { AbstractParseTreeVisitor } from "antlr4ng";


import { OwnedExpressionContext } from "./SysMLv2Parser.js";
import { TypeReferenceContext } from "./SysMLv2Parser.js";
import { SequenceExpressionListContext } from "./SysMLv2Parser.js";
import { BaseExpressionContext } from "./SysMLv2Parser.js";
import { NullExpressionContext } from "./SysMLv2Parser.js";
import { FeatureReferenceExpressionContext } from "./SysMLv2Parser.js";
import { ConstructorExpressionContext } from "./SysMLv2Parser.js";
import { BodyExpressionContext } from "./SysMLv2Parser.js";
import { ArgumentListContext } from "./SysMLv2Parser.js";
import { PositionalArgumentListContext } from "./SysMLv2Parser.js";
import { NamedArgumentListContext } from "./SysMLv2Parser.js";
import { NamedArgumentContext } from "./SysMLv2Parser.js";
import { LiteralExpressionContext } from "./SysMLv2Parser.js";
import { LiteralBooleanContext } from "./SysMLv2Parser.js";
import { LiteralStringContext } from "./SysMLv2Parser.js";
import { LiteralIntegerContext } from "./SysMLv2Parser.js";
import { LiteralRealContext } from "./SysMLv2Parser.js";
import { LiteralInfinityContext } from "./SysMLv2Parser.js";
import { ArgumentMemberContext } from "./SysMLv2Parser.js";
import { ArgumentExpressionMemberContext } from "./SysMLv2Parser.js";
import { NameContext } from "./SysMLv2Parser.js";
import { UnreservedKeywordContext } from "./SysMLv2Parser.js";
import { IdentificationContext } from "./SysMLv2Parser.js";
import { RelationshipBodyContext } from "./SysMLv2Parser.js";
import { RelationshipOwnedElementContext } from "./SysMLv2Parser.js";
import { OwnedRelatedElementContext } from "./SysMLv2Parser.js";
import { DependencyContext } from "./SysMLv2Parser.js";
import { AnnotationContext } from "./SysMLv2Parser.js";
import { OwnedAnnotationContext } from "./SysMLv2Parser.js";
import { AnnotatingElementContext } from "./SysMLv2Parser.js";
import { CommentContext } from "./SysMLv2Parser.js";
import { DocumentationContext } from "./SysMLv2Parser.js";
import { TextualRepresentationContext } from "./SysMLv2Parser.js";
import { RootNamespaceContext } from "./SysMLv2Parser.js";
import { NamespaceContext } from "./SysMLv2Parser.js";
import { NamespaceDeclarationContext } from "./SysMLv2Parser.js";
import { NamespaceBodyContext } from "./SysMLv2Parser.js";
import { NamespaceBodyElementContext } from "./SysMLv2Parser.js";
import { MemberPrefixContext } from "./SysMLv2Parser.js";
import { VisibilityIndicatorContext } from "./SysMLv2Parser.js";
import { NamespaceMemberContext } from "./SysMLv2Parser.js";
import { NonFeatureMemberContext } from "./SysMLv2Parser.js";
import { NamespaceFeatureMemberContext } from "./SysMLv2Parser.js";
import { AliasMemberContext } from "./SysMLv2Parser.js";
import { QualifiedNameContext } from "./SysMLv2Parser.js";
import { ImportRuleContext } from "./SysMLv2Parser.js";
import { ImportDeclarationContext } from "./SysMLv2Parser.js";
import { MembershipImportContext } from "./SysMLv2Parser.js";
import { NamespaceImportContext } from "./SysMLv2Parser.js";
import { FilterPackageContext } from "./SysMLv2Parser.js";
import { FilterPackageMemberContext } from "./SysMLv2Parser.js";
import { MemberElementContext } from "./SysMLv2Parser.js";
import { NonFeatureElementContext } from "./SysMLv2Parser.js";
import { FeatureElementContext } from "./SysMLv2Parser.js";
import { TypeContext } from "./SysMLv2Parser.js";
import { TypePrefixContext } from "./SysMLv2Parser.js";
import { TypeDeclarationContext } from "./SysMLv2Parser.js";
import { SpecializationPartContext } from "./SysMLv2Parser.js";
import { ConjugationPartContext } from "./SysMLv2Parser.js";
import { TypeRelationshipPartContext } from "./SysMLv2Parser.js";
import { DisjoiningPartContext } from "./SysMLv2Parser.js";
import { UnioningPartContext } from "./SysMLv2Parser.js";
import { IntersectingPartContext } from "./SysMLv2Parser.js";
import { DifferencingPartContext } from "./SysMLv2Parser.js";
import { TypeBodyContext } from "./SysMLv2Parser.js";
import { TypeBodyElementContext } from "./SysMLv2Parser.js";
import { SpecializationContext } from "./SysMLv2Parser.js";
import { OwnedSpecializationContext } from "./SysMLv2Parser.js";
import { SpecificTypeContext } from "./SysMLv2Parser.js";
import { GeneralTypeContext } from "./SysMLv2Parser.js";
import { ConjugationContext } from "./SysMLv2Parser.js";
import { OwnedConjugationContext } from "./SysMLv2Parser.js";
import { DisjoiningContext } from "./SysMLv2Parser.js";
import { OwnedDisjoiningContext } from "./SysMLv2Parser.js";
import { UnioningContext } from "./SysMLv2Parser.js";
import { IntersectingContext } from "./SysMLv2Parser.js";
import { DifferencingContext } from "./SysMLv2Parser.js";
import { FeatureMemberContext } from "./SysMLv2Parser.js";
import { TypeFeatureMemberContext } from "./SysMLv2Parser.js";
import { OwnedFeatureMemberContext } from "./SysMLv2Parser.js";
import { ClassifierContext } from "./SysMLv2Parser.js";
import { ClassifierDeclarationContext } from "./SysMLv2Parser.js";
import { SuperclassingPartContext } from "./SysMLv2Parser.js";
import { SubclassificationContext } from "./SysMLv2Parser.js";
import { OwnedSubclassificationContext } from "./SysMLv2Parser.js";
import { FeatureContext } from "./SysMLv2Parser.js";
import { EndFeaturePrefixContext } from "./SysMLv2Parser.js";
import { BasicFeaturePrefixContext } from "./SysMLv2Parser.js";
import { FeaturePrefixContext } from "./SysMLv2Parser.js";
import { OwnedCrossFeatureMemberContext } from "./SysMLv2Parser.js";
import { OwnedCrossFeatureContext } from "./SysMLv2Parser.js";
import { FeatureDirectionContext } from "./SysMLv2Parser.js";
import { FeatureDeclarationContext } from "./SysMLv2Parser.js";
import { FeatureIdentificationContext } from "./SysMLv2Parser.js";
import { FeatureRelationshipPartContext } from "./SysMLv2Parser.js";
import { ChainingPartContext } from "./SysMLv2Parser.js";
import { InvertingPartContext } from "./SysMLv2Parser.js";
import { TypeFeaturingPartContext } from "./SysMLv2Parser.js";
import { FeatureSpecializationPartContext } from "./SysMLv2Parser.js";
import { MultiplicityPartContext } from "./SysMLv2Parser.js";
import { FeatureSpecializationContext } from "./SysMLv2Parser.js";
import { TypingsContext } from "./SysMLv2Parser.js";
import { TypedByContext } from "./SysMLv2Parser.js";
import { SubsettingsContext } from "./SysMLv2Parser.js";
import { SubsetsContext } from "./SysMLv2Parser.js";
import { ReferencesContext } from "./SysMLv2Parser.js";
import { CrossesContext } from "./SysMLv2Parser.js";
import { RedefinitionsContext } from "./SysMLv2Parser.js";
import { RedefinesContext } from "./SysMLv2Parser.js";
import { FeatureTypingContext } from "./SysMLv2Parser.js";
import { OwnedFeatureTypingContext } from "./SysMLv2Parser.js";
import { SubsettingContext } from "./SysMLv2Parser.js";
import { OwnedSubsettingContext } from "./SysMLv2Parser.js";
import { OwnedReferenceSubsettingContext } from "./SysMLv2Parser.js";
import { OwnedCrossSubsettingContext } from "./SysMLv2Parser.js";
import { RedefinitionContext } from "./SysMLv2Parser.js";
import { OwnedRedefinitionContext } from "./SysMLv2Parser.js";
import { FeatureInvertingContext } from "./SysMLv2Parser.js";
import { OwnedFeatureInvertingContext } from "./SysMLv2Parser.js";
import { TypeFeaturingContext } from "./SysMLv2Parser.js";
import { OwnedTypeFeaturingContext } from "./SysMLv2Parser.js";
import { DataTypeContext } from "./SysMLv2Parser.js";
import { ClassContext } from "./SysMLv2Parser.js";
import { StructureContext } from "./SysMLv2Parser.js";
import { AssociationContext } from "./SysMLv2Parser.js";
import { AssociationStructureContext } from "./SysMLv2Parser.js";
import { ConnectorContext } from "./SysMLv2Parser.js";
import { ConnectorDeclarationContext } from "./SysMLv2Parser.js";
import { BinaryConnectorDeclarationContext } from "./SysMLv2Parser.js";
import { NaryConnectorDeclarationContext } from "./SysMLv2Parser.js";
import { ConnectorEndMemberContext } from "./SysMLv2Parser.js";
import { ConnectorEndContext } from "./SysMLv2Parser.js";
import { OwnedCrossMultiplicityMemberContext } from "./SysMLv2Parser.js";
import { OwnedCrossMultiplicityContext } from "./SysMLv2Parser.js";
import { BindingConnectorContext } from "./SysMLv2Parser.js";
import { BindingConnectorDeclarationContext } from "./SysMLv2Parser.js";
import { SuccessionContext } from "./SysMLv2Parser.js";
import { SuccessionDeclarationContext } from "./SysMLv2Parser.js";
import { BehaviorContext } from "./SysMLv2Parser.js";
import { StepContext } from "./SysMLv2Parser.js";
import { FunctionContext } from "./SysMLv2Parser.js";
import { FunctionBodyContext } from "./SysMLv2Parser.js";
import { FunctionBodyPartContext } from "./SysMLv2Parser.js";
import { ReturnFeatureMemberContext } from "./SysMLv2Parser.js";
import { ResultExpressionMemberContext } from "./SysMLv2Parser.js";
import { ExpressionContext } from "./SysMLv2Parser.js";
import { PredicateContext } from "./SysMLv2Parser.js";
import { BooleanExpressionContext } from "./SysMLv2Parser.js";
import { InvariantContext } from "./SysMLv2Parser.js";
import { FeatureChainMemberContext } from "./SysMLv2Parser.js";
import { InteractionContext } from "./SysMLv2Parser.js";
import { FlowContext } from "./SysMLv2Parser.js";
import { SuccessionFlowContext } from "./SysMLv2Parser.js";
import { FlowDeclarationContext } from "./SysMLv2Parser.js";
import { PayloadFeatureMemberContext } from "./SysMLv2Parser.js";
import { PayloadFeatureContext } from "./SysMLv2Parser.js";
import { PayloadFeatureSpecializationPartContext } from "./SysMLv2Parser.js";
import { FlowEndMemberContext } from "./SysMLv2Parser.js";
import { FlowEndContext } from "./SysMLv2Parser.js";
import { ValuePartContext } from "./SysMLv2Parser.js";
import { FeatureValueContext } from "./SysMLv2Parser.js";
import { MultiplicityContext } from "./SysMLv2Parser.js";
import { MultiplicitySubsetContext } from "./SysMLv2Parser.js";
import { MultiplicityRangeContext } from "./SysMLv2Parser.js";
import { OwnedMultiplicityContext } from "./SysMLv2Parser.js";
import { OwnedMultiplicityRangeContext } from "./SysMLv2Parser.js";
import { MultiplicityBoundsContext } from "./SysMLv2Parser.js";
import { MultiplicityExpressionMemberContext } from "./SysMLv2Parser.js";
import { MetaclassContext } from "./SysMLv2Parser.js";
import { PrefixMetadataAnnotationContext } from "./SysMLv2Parser.js";
import { PrefixMetadataMemberContext } from "./SysMLv2Parser.js";
import { PrefixMetadataFeatureContext } from "./SysMLv2Parser.js";
import { MetadataFeatureContext } from "./SysMLv2Parser.js";
import { MetadataFeatureDeclarationContext } from "./SysMLv2Parser.js";
import { MetadataBodyContext } from "./SysMLv2Parser.js";
import { MetadataBodyElementContext } from "./SysMLv2Parser.js";
import { MetadataBodyFeatureMemberContext } from "./SysMLv2Parser.js";
import { MetadataBodyFeatureContext } from "./SysMLv2Parser.js";
import { PackageContext } from "./SysMLv2Parser.js";
import { LibraryPackageContext } from "./SysMLv2Parser.js";
import { PackageDeclarationContext } from "./SysMLv2Parser.js";
import { PackageBodyContext } from "./SysMLv2Parser.js";
import { ElementFilterMemberContext } from "./SysMLv2Parser.js";
import { DependencyDeclarationContext } from "./SysMLv2Parser.js";
import { AnnotatingMemberContext } from "./SysMLv2Parser.js";
import { PackageBodyElementContext } from "./SysMLv2Parser.js";
import { PackageMemberContext } from "./SysMLv2Parser.js";
import { DefinitionElementContext } from "./SysMLv2Parser.js";
import { UsageElementContext } from "./SysMLv2Parser.js";
import { BasicDefinitionPrefixContext } from "./SysMLv2Parser.js";
import { DefinitionExtensionKeywordContext } from "./SysMLv2Parser.js";
import { DefinitionPrefixContext } from "./SysMLv2Parser.js";
import { DefinitionContext } from "./SysMLv2Parser.js";
import { DefinitionDeclarationContext } from "./SysMLv2Parser.js";
import { DefinitionBodyContext } from "./SysMLv2Parser.js";
import { DefinitionBodyItemContext } from "./SysMLv2Parser.js";
import { DefinitionBodyItemContentContext } from "./SysMLv2Parser.js";
import { DefinitionMemberContext } from "./SysMLv2Parser.js";
import { VariantUsageMemberContext } from "./SysMLv2Parser.js";
import { NonOccurrenceUsageMemberContext } from "./SysMLv2Parser.js";
import { StructureUsageMemberContext } from "./SysMLv2Parser.js";
import { BehaviorUsageMemberContext } from "./SysMLv2Parser.js";
import { RefPrefixContext } from "./SysMLv2Parser.js";
import { BasicUsagePrefixContext } from "./SysMLv2Parser.js";
import { EndUsagePrefixContext } from "./SysMLv2Parser.js";
import { UsageExtensionKeywordContext } from "./SysMLv2Parser.js";
import { UnextendedUsagePrefixContext } from "./SysMLv2Parser.js";
import { UsagePrefixContext } from "./SysMLv2Parser.js";
import { UsageContext } from "./SysMLv2Parser.js";
import { UsageDeclarationContext } from "./SysMLv2Parser.js";
import { UsageCompletionContext } from "./SysMLv2Parser.js";
import { UsageBodyContext } from "./SysMLv2Parser.js";
import { DefaultReferenceUsageContext } from "./SysMLv2Parser.js";
import { ReferenceUsageContext } from "./SysMLv2Parser.js";
import { EndFeatureUsageContext } from "./SysMLv2Parser.js";
import { VariantReferenceContext } from "./SysMLv2Parser.js";
import { NonOccurrenceUsageElementContext } from "./SysMLv2Parser.js";
import { EndOccurrenceUsageElementContext } from "./SysMLv2Parser.js";
import { OccurrenceUsageElementContext } from "./SysMLv2Parser.js";
import { StructureUsageElementContext } from "./SysMLv2Parser.js";
import { BehaviorUsageElementContext } from "./SysMLv2Parser.js";
import { VariantUsageElementContext } from "./SysMLv2Parser.js";
import { SubclassificationPartContext } from "./SysMLv2Parser.js";
import { AttributeDefinitionContext } from "./SysMLv2Parser.js";
import { AttributeUsageContext } from "./SysMLv2Parser.js";
import { EnumerationDefinitionContext } from "./SysMLv2Parser.js";
import { EnumerationBodyContext } from "./SysMLv2Parser.js";
import { EnumerationUsageMemberContext } from "./SysMLv2Parser.js";
import { EnumeratedValueContext } from "./SysMLv2Parser.js";
import { EnumerationUsageContext } from "./SysMLv2Parser.js";
import { OccurrenceDefinitionPrefixContext } from "./SysMLv2Parser.js";
import { OccurrenceDefinitionContext } from "./SysMLv2Parser.js";
import { IndividualDefinitionContext } from "./SysMLv2Parser.js";
import { EmptyMultiplicityMemberContext } from "./SysMLv2Parser.js";
import { OccurrenceUsagePrefixContext } from "./SysMLv2Parser.js";
import { OccurrenceUsageContext } from "./SysMLv2Parser.js";
import { IndividualUsageContext } from "./SysMLv2Parser.js";
import { PortionUsageContext } from "./SysMLv2Parser.js";
import { PortionKindContext } from "./SysMLv2Parser.js";
import { EventOccurrenceUsageContext } from "./SysMLv2Parser.js";
import { SourceSuccessionMemberContext } from "./SysMLv2Parser.js";
import { SourceSuccessionContext } from "./SysMLv2Parser.js";
import { SourceEndMemberContext } from "./SysMLv2Parser.js";
import { SourceEndContext } from "./SysMLv2Parser.js";
import { ItemDefinitionContext } from "./SysMLv2Parser.js";
import { ItemUsageContext } from "./SysMLv2Parser.js";
import { PartDefinitionContext } from "./SysMLv2Parser.js";
import { PartUsageContext } from "./SysMLv2Parser.js";
import { PortDefinitionContext } from "./SysMLv2Parser.js";
import { ConjugatedPortDefinitionMemberContext } from "./SysMLv2Parser.js";
import { ConjugatedPortDefinitionContext } from "./SysMLv2Parser.js";
import { PortUsageContext } from "./SysMLv2Parser.js";
import { ConjugatedPortTypingContext } from "./SysMLv2Parser.js";
import { ConnectionDefinitionContext } from "./SysMLv2Parser.js";
import { ConnectionUsageContext } from "./SysMLv2Parser.js";
import { ConnectorPartContext } from "./SysMLv2Parser.js";
import { BinaryConnectorPartContext } from "./SysMLv2Parser.js";
import { NaryConnectorPartContext } from "./SysMLv2Parser.js";
import { BindingConnectorAsUsageContext } from "./SysMLv2Parser.js";
import { SuccessionAsUsageContext } from "./SysMLv2Parser.js";
import { InterfaceDefinitionContext } from "./SysMLv2Parser.js";
import { InterfaceBodyContext } from "./SysMLv2Parser.js";
import { InterfaceBodyItemContext } from "./SysMLv2Parser.js";
import { InterfaceNonOccurrenceUsageMemberContext } from "./SysMLv2Parser.js";
import { InterfaceNonOccurrenceUsageElementContext } from "./SysMLv2Parser.js";
import { InterfaceOccurrenceUsageMemberContext } from "./SysMLv2Parser.js";
import { InterfaceOccurrenceUsageElementContext } from "./SysMLv2Parser.js";
import { DefaultInterfaceEndContext } from "./SysMLv2Parser.js";
import { InterfaceUsageContext } from "./SysMLv2Parser.js";
import { InterfaceUsageDeclarationContext } from "./SysMLv2Parser.js";
import { InterfacePartContext } from "./SysMLv2Parser.js";
import { BinaryInterfacePartContext } from "./SysMLv2Parser.js";
import { NaryInterfacePartContext } from "./SysMLv2Parser.js";
import { InterfaceEndMemberContext } from "./SysMLv2Parser.js";
import { InterfaceEndContext } from "./SysMLv2Parser.js";
import { AllocationDefinitionContext } from "./SysMLv2Parser.js";
import { AllocationUsageContext } from "./SysMLv2Parser.js";
import { AllocationUsageDeclarationContext } from "./SysMLv2Parser.js";
import { FlowDefinitionContext } from "./SysMLv2Parser.js";
import { MessageContext } from "./SysMLv2Parser.js";
import { MessageDeclarationContext } from "./SysMLv2Parser.js";
import { MessageEventMemberContext } from "./SysMLv2Parser.js";
import { MessageEventContext } from "./SysMLv2Parser.js";
import { FlowUsageContext } from "./SysMLv2Parser.js";
import { SuccessionFlowUsageContext } from "./SysMLv2Parser.js";
import { FlowPayloadFeatureMemberContext } from "./SysMLv2Parser.js";
import { FlowPayloadFeatureContext } from "./SysMLv2Parser.js";
import { ActionDefinitionContext } from "./SysMLv2Parser.js";
import { ActionBodyContext } from "./SysMLv2Parser.js";
import { ActionBodyItemContext } from "./SysMLv2Parser.js";
import { NonBehaviorBodyItemContext } from "./SysMLv2Parser.js";
import { ActionBehaviorMemberContext } from "./SysMLv2Parser.js";
import { InitialNodeMemberContext } from "./SysMLv2Parser.js";
import { ActionNodeMemberContext } from "./SysMLv2Parser.js";
import { ActionTargetSuccessionMemberContext } from "./SysMLv2Parser.js";
import { GuardedSuccessionMemberContext } from "./SysMLv2Parser.js";
import { ActionUsageContext } from "./SysMLv2Parser.js";
import { ActionUsageDeclarationContext } from "./SysMLv2Parser.js";
import { PerformActionUsageContext } from "./SysMLv2Parser.js";
import { PerformActionUsageDeclarationContext } from "./SysMLv2Parser.js";
import { ActionNodeContext } from "./SysMLv2Parser.js";
import { ActionNodeUsageDeclarationContext } from "./SysMLv2Parser.js";
import { ActionNodePrefixContext } from "./SysMLv2Parser.js";
import { ControlNodeContext } from "./SysMLv2Parser.js";
import { ControlNodePrefixContext } from "./SysMLv2Parser.js";
import { MergeNodeContext } from "./SysMLv2Parser.js";
import { DecisionNodeContext } from "./SysMLv2Parser.js";
import { JoinNodeContext } from "./SysMLv2Parser.js";
import { ForkNodeContext } from "./SysMLv2Parser.js";
import { AcceptNodeContext } from "./SysMLv2Parser.js";
import { AcceptNodeDeclarationContext } from "./SysMLv2Parser.js";
import { AcceptParameterPartContext } from "./SysMLv2Parser.js";
import { PayloadParameterMemberContext } from "./SysMLv2Parser.js";
import { PayloadParameterContext } from "./SysMLv2Parser.js";
import { TriggerValuePartContext } from "./SysMLv2Parser.js";
import { TriggerFeatureValueContext } from "./SysMLv2Parser.js";
import { TriggerExpressionContext } from "./SysMLv2Parser.js";
import { SendNodeContext } from "./SysMLv2Parser.js";
import { SendNodeDeclarationContext } from "./SysMLv2Parser.js";
import { SenderReceiverPartContext } from "./SysMLv2Parser.js";
import { NodeParameterMemberContext } from "./SysMLv2Parser.js";
import { NodeParameterContext } from "./SysMLv2Parser.js";
import { FeatureBindingContext } from "./SysMLv2Parser.js";
import { EmptyParameterMemberContext } from "./SysMLv2Parser.js";
import { AssignmentNodeContext } from "./SysMLv2Parser.js";
import { AssignmentNodeDeclarationContext } from "./SysMLv2Parser.js";
import { AssignmentTargetMemberContext } from "./SysMLv2Parser.js";
import { AssignmentTargetParameterContext } from "./SysMLv2Parser.js";
import { AssignmentTargetBindingContext } from "./SysMLv2Parser.js";
import { TerminateNodeContext } from "./SysMLv2Parser.js";
import { IfNodeContext } from "./SysMLv2Parser.js";
import { ExpressionParameterMemberContext } from "./SysMLv2Parser.js";
import { ActionBodyParameterMemberContext } from "./SysMLv2Parser.js";
import { ActionBodyParameterContext } from "./SysMLv2Parser.js";
import { IfNodeParameterMemberContext } from "./SysMLv2Parser.js";
import { WhileLoopNodeContext } from "./SysMLv2Parser.js";
import { ForLoopNodeContext } from "./SysMLv2Parser.js";
import { ForVariableDeclarationMemberContext } from "./SysMLv2Parser.js";
import { ActionTargetSuccessionContext } from "./SysMLv2Parser.js";
import { TargetSuccessionContext } from "./SysMLv2Parser.js";
import { GuardedTargetSuccessionContext } from "./SysMLv2Parser.js";
import { DefaultTargetSuccessionContext } from "./SysMLv2Parser.js";
import { GuardedSuccessionContext } from "./SysMLv2Parser.js";
import { StateDefinitionContext } from "./SysMLv2Parser.js";
import { StateDefBodyContext } from "./SysMLv2Parser.js";
import { StateBodyItemContext } from "./SysMLv2Parser.js";
import { EntryActionMemberContext } from "./SysMLv2Parser.js";
import { DoActionMemberContext } from "./SysMLv2Parser.js";
import { ExitActionMemberContext } from "./SysMLv2Parser.js";
import { EntryTransitionMemberContext } from "./SysMLv2Parser.js";
import { StateActionUsageContext } from "./SysMLv2Parser.js";
import { StatePerformActionUsageContext } from "./SysMLv2Parser.js";
import { StateAcceptActionUsageContext } from "./SysMLv2Parser.js";
import { StateSendActionUsageContext } from "./SysMLv2Parser.js";
import { StateAssignmentActionUsageContext } from "./SysMLv2Parser.js";
import { TransitionUsageMemberContext } from "./SysMLv2Parser.js";
import { TargetTransitionUsageMemberContext } from "./SysMLv2Parser.js";
import { StateUsageContext } from "./SysMLv2Parser.js";
import { StateUsageBodyContext } from "./SysMLv2Parser.js";
import { ExhibitStateUsageContext } from "./SysMLv2Parser.js";
import { TransitionUsageContext } from "./SysMLv2Parser.js";
import { TargetTransitionUsageContext } from "./SysMLv2Parser.js";
import { TriggerActionMemberContext } from "./SysMLv2Parser.js";
import { TriggerActionContext } from "./SysMLv2Parser.js";
import { GuardExpressionMemberContext } from "./SysMLv2Parser.js";
import { EffectBehaviorMemberContext } from "./SysMLv2Parser.js";
import { EffectBehaviorUsageContext } from "./SysMLv2Parser.js";
import { TransitionPerformActionUsageContext } from "./SysMLv2Parser.js";
import { TransitionAcceptActionUsageContext } from "./SysMLv2Parser.js";
import { TransitionSendActionUsageContext } from "./SysMLv2Parser.js";
import { TransitionAssignmentActionUsageContext } from "./SysMLv2Parser.js";
import { TransitionSuccessionMemberContext } from "./SysMLv2Parser.js";
import { TransitionSuccessionContext } from "./SysMLv2Parser.js";
import { EmptyEndMemberContext } from "./SysMLv2Parser.js";
import { CalculationDefinitionContext } from "./SysMLv2Parser.js";
import { CalculationUsageContext } from "./SysMLv2Parser.js";
import { CalculationBodyContext } from "./SysMLv2Parser.js";
import { CalculationBodyPartContext } from "./SysMLv2Parser.js";
import { CalculationBodyItemContext } from "./SysMLv2Parser.js";
import { ReturnParameterMemberContext } from "./SysMLv2Parser.js";
import { ConstraintDefinitionContext } from "./SysMLv2Parser.js";
import { ConstraintUsageContext } from "./SysMLv2Parser.js";
import { AssertConstraintUsageContext } from "./SysMLv2Parser.js";
import { ConstraintUsageDeclarationContext } from "./SysMLv2Parser.js";
import { RequirementDefinitionContext } from "./SysMLv2Parser.js";
import { RequirementBodyContext } from "./SysMLv2Parser.js";
import { RequirementBodyItemContext } from "./SysMLv2Parser.js";
import { SubjectMemberContext } from "./SysMLv2Parser.js";
import { SubjectUsageContext } from "./SysMLv2Parser.js";
import { RequirementConstraintMemberContext } from "./SysMLv2Parser.js";
import { RequirementKindContext } from "./SysMLv2Parser.js";
import { RequirementConstraintUsageContext } from "./SysMLv2Parser.js";
import { FramedConcernMemberContext } from "./SysMLv2Parser.js";
import { FramedConcernUsageContext } from "./SysMLv2Parser.js";
import { ActorMemberContext } from "./SysMLv2Parser.js";
import { ActorUsageContext } from "./SysMLv2Parser.js";
import { StakeholderMemberContext } from "./SysMLv2Parser.js";
import { StakeholderUsageContext } from "./SysMLv2Parser.js";
import { RequirementUsageContext } from "./SysMLv2Parser.js";
import { SatisfyRequirementUsageContext } from "./SysMLv2Parser.js";
import { SatisfactionSubjectMemberContext } from "./SysMLv2Parser.js";
import { SatisfactionParameterContext } from "./SysMLv2Parser.js";
import { SatisfactionFeatureValueContext } from "./SysMLv2Parser.js";
import { SatisfactionReferenceExpressionContext } from "./SysMLv2Parser.js";
import { ConcernDefinitionContext } from "./SysMLv2Parser.js";
import { ConcernUsageContext } from "./SysMLv2Parser.js";
import { CaseDefinitionContext } from "./SysMLv2Parser.js";
import { CaseUsageContext } from "./SysMLv2Parser.js";
import { CaseBodyContext } from "./SysMLv2Parser.js";
import { CaseBodyItemContext } from "./SysMLv2Parser.js";
import { ObjectiveMemberContext } from "./SysMLv2Parser.js";
import { ObjectiveRequirementUsageContext } from "./SysMLv2Parser.js";
import { AnalysisCaseDefinitionContext } from "./SysMLv2Parser.js";
import { AnalysisCaseUsageContext } from "./SysMLv2Parser.js";
import { VerificationCaseDefinitionContext } from "./SysMLv2Parser.js";
import { VerificationCaseUsageContext } from "./SysMLv2Parser.js";
import { RequirementVerificationMemberContext } from "./SysMLv2Parser.js";
import { RequirementVerificationUsageContext } from "./SysMLv2Parser.js";
import { UseCaseDefinitionContext } from "./SysMLv2Parser.js";
import { UseCaseUsageContext } from "./SysMLv2Parser.js";
import { IncludeUseCaseUsageContext } from "./SysMLv2Parser.js";
import { ViewDefinitionContext } from "./SysMLv2Parser.js";
import { ViewDefinitionBodyContext } from "./SysMLv2Parser.js";
import { ViewDefinitionBodyItemContext } from "./SysMLv2Parser.js";
import { ViewRenderingMemberContext } from "./SysMLv2Parser.js";
import { ViewRenderingUsageContext } from "./SysMLv2Parser.js";
import { ViewUsageContext } from "./SysMLv2Parser.js";
import { ViewBodyContext } from "./SysMLv2Parser.js";
import { ViewBodyItemContext } from "./SysMLv2Parser.js";
import { ExposeContext } from "./SysMLv2Parser.js";
import { MembershipExposeContext } from "./SysMLv2Parser.js";
import { NamespaceExposeContext } from "./SysMLv2Parser.js";
import { ViewpointDefinitionContext } from "./SysMLv2Parser.js";
import { ViewpointUsageContext } from "./SysMLv2Parser.js";
import { RenderingDefinitionContext } from "./SysMLv2Parser.js";
import { RenderingUsageContext } from "./SysMLv2Parser.js";
import { MetadataDefinitionContext } from "./SysMLv2Parser.js";
import { PrefixMetadataUsageContext } from "./SysMLv2Parser.js";
import { MetadataBodyUsageMemberContext } from "./SysMLv2Parser.js";
import { MetadataBodyUsageContext } from "./SysMLv2Parser.js";
import { ExtendedDefinitionContext } from "./SysMLv2Parser.js";
import { ExtendedUsageContext } from "./SysMLv2Parser.js";
import { FilterPackageImportDeclarationContext } from "./SysMLv2Parser.js";
import { NamespaceImportDirectContext } from "./SysMLv2Parser.js";
import { CalculationUsageDeclarationContext } from "./SysMLv2Parser.js";
import { EmptyActionUsage_Context } from "./SysMLv2Parser.js";
import { EmptyFeature_Context } from "./SysMLv2Parser.js";
import { EmptyMultiplicity_Context } from "./SysMLv2Parser.js";
import { EmptyUsage_Context } from "./SysMLv2Parser.js";
import { FilterPackageImportContext } from "./SysMLv2Parser.js";
import { NonFeatureChainPrimaryExpressionContext } from "./SysMLv2Parser.js";
import { PortConjugationContext } from "./SysMLv2Parser.js";


/**
 * This interface defines a complete generic visitor for a parse tree produced
 * by `SysMLv2Parser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export class SysMLv2ParserVisitor<Result> extends AbstractParseTreeVisitor<Result> {
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedExpression?: (ctx: OwnedExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.typeReference`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeReference?: (ctx: TypeReferenceContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.sequenceExpressionList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSequenceExpressionList?: (ctx: SequenceExpressionListContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.baseExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBaseExpression?: (ctx: BaseExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.nullExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNullExpression?: (ctx: NullExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.featureReferenceExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeatureReferenceExpression?: (ctx: FeatureReferenceExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.constructorExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConstructorExpression?: (ctx: ConstructorExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.bodyExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBodyExpression?: (ctx: BodyExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.argumentList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArgumentList?: (ctx: ArgumentListContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.positionalArgumentList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPositionalArgumentList?: (ctx: PositionalArgumentListContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.namedArgumentList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamedArgumentList?: (ctx: NamedArgumentListContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.namedArgument`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamedArgument?: (ctx: NamedArgumentContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.literalExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteralExpression?: (ctx: LiteralExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.literalBoolean`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteralBoolean?: (ctx: LiteralBooleanContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.literalString`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteralString?: (ctx: LiteralStringContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.literalInteger`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteralInteger?: (ctx: LiteralIntegerContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.literalReal`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteralReal?: (ctx: LiteralRealContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.literalInfinity`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteralInfinity?: (ctx: LiteralInfinityContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.argumentMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArgumentMember?: (ctx: ArgumentMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.argumentExpressionMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArgumentExpressionMember?: (ctx: ArgumentExpressionMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.name`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitName?: (ctx: NameContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.unreservedKeyword`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUnreservedKeyword?: (ctx: UnreservedKeywordContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.identification`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIdentification?: (ctx: IdentificationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.relationshipBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRelationshipBody?: (ctx: RelationshipBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.relationshipOwnedElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRelationshipOwnedElement?: (ctx: RelationshipOwnedElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedRelatedElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedRelatedElement?: (ctx: OwnedRelatedElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.dependency`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDependency?: (ctx: DependencyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.annotation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAnnotation?: (ctx: AnnotationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedAnnotation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedAnnotation?: (ctx: OwnedAnnotationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.annotatingElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAnnotatingElement?: (ctx: AnnotatingElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.comment`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitComment?: (ctx: CommentContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.documentation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDocumentation?: (ctx: DocumentationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.textualRepresentation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTextualRepresentation?: (ctx: TextualRepresentationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.rootNamespace`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRootNamespace?: (ctx: RootNamespaceContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.namespace`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamespace?: (ctx: NamespaceContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.namespaceDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamespaceDeclaration?: (ctx: NamespaceDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.namespaceBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamespaceBody?: (ctx: NamespaceBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.namespaceBodyElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamespaceBodyElement?: (ctx: NamespaceBodyElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.memberPrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMemberPrefix?: (ctx: MemberPrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.visibilityIndicator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVisibilityIndicator?: (ctx: VisibilityIndicatorContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.namespaceMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamespaceMember?: (ctx: NamespaceMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.nonFeatureMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNonFeatureMember?: (ctx: NonFeatureMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.namespaceFeatureMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamespaceFeatureMember?: (ctx: NamespaceFeatureMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.aliasMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAliasMember?: (ctx: AliasMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.qualifiedName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitQualifiedName?: (ctx: QualifiedNameContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.importRule`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitImportRule?: (ctx: ImportRuleContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.importDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitImportDeclaration?: (ctx: ImportDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.membershipImport`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMembershipImport?: (ctx: MembershipImportContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.namespaceImport`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamespaceImport?: (ctx: NamespaceImportContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.filterPackage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFilterPackage?: (ctx: FilterPackageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.filterPackageMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFilterPackageMember?: (ctx: FilterPackageMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.memberElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMemberElement?: (ctx: MemberElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.nonFeatureElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNonFeatureElement?: (ctx: NonFeatureElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.featureElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeatureElement?: (ctx: FeatureElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.type`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitType?: (ctx: TypeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.typePrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypePrefix?: (ctx: TypePrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.typeDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeDeclaration?: (ctx: TypeDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.specializationPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSpecializationPart?: (ctx: SpecializationPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.conjugationPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConjugationPart?: (ctx: ConjugationPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.typeRelationshipPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeRelationshipPart?: (ctx: TypeRelationshipPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.disjoiningPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDisjoiningPart?: (ctx: DisjoiningPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.unioningPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUnioningPart?: (ctx: UnioningPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.intersectingPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIntersectingPart?: (ctx: IntersectingPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.differencingPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDifferencingPart?: (ctx: DifferencingPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.typeBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeBody?: (ctx: TypeBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.typeBodyElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeBodyElement?: (ctx: TypeBodyElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.specialization`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSpecialization?: (ctx: SpecializationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedSpecialization`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedSpecialization?: (ctx: OwnedSpecializationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.specificType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSpecificType?: (ctx: SpecificTypeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.generalType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitGeneralType?: (ctx: GeneralTypeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.conjugation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConjugation?: (ctx: ConjugationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedConjugation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedConjugation?: (ctx: OwnedConjugationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.disjoining`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDisjoining?: (ctx: DisjoiningContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedDisjoining`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedDisjoining?: (ctx: OwnedDisjoiningContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.unioning`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUnioning?: (ctx: UnioningContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.intersecting`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIntersecting?: (ctx: IntersectingContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.differencing`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDifferencing?: (ctx: DifferencingContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.featureMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeatureMember?: (ctx: FeatureMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.typeFeatureMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeFeatureMember?: (ctx: TypeFeatureMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedFeatureMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedFeatureMember?: (ctx: OwnedFeatureMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.classifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassifier?: (ctx: ClassifierContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.classifierDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassifierDeclaration?: (ctx: ClassifierDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.superclassingPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSuperclassingPart?: (ctx: SuperclassingPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.subclassification`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSubclassification?: (ctx: SubclassificationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedSubclassification`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedSubclassification?: (ctx: OwnedSubclassificationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.feature`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeature?: (ctx: FeatureContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.endFeaturePrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEndFeaturePrefix?: (ctx: EndFeaturePrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.basicFeaturePrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBasicFeaturePrefix?: (ctx: BasicFeaturePrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.featurePrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeaturePrefix?: (ctx: FeaturePrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedCrossFeatureMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedCrossFeatureMember?: (ctx: OwnedCrossFeatureMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedCrossFeature`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedCrossFeature?: (ctx: OwnedCrossFeatureContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.featureDirection`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeatureDirection?: (ctx: FeatureDirectionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.featureDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeatureDeclaration?: (ctx: FeatureDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.featureIdentification`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeatureIdentification?: (ctx: FeatureIdentificationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.featureRelationshipPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeatureRelationshipPart?: (ctx: FeatureRelationshipPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.chainingPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitChainingPart?: (ctx: ChainingPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.invertingPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInvertingPart?: (ctx: InvertingPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.typeFeaturingPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeFeaturingPart?: (ctx: TypeFeaturingPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.featureSpecializationPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeatureSpecializationPart?: (ctx: FeatureSpecializationPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.multiplicityPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMultiplicityPart?: (ctx: MultiplicityPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.featureSpecialization`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeatureSpecialization?: (ctx: FeatureSpecializationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.typings`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypings?: (ctx: TypingsContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.typedBy`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypedBy?: (ctx: TypedByContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.subsettings`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSubsettings?: (ctx: SubsettingsContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.subsets`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSubsets?: (ctx: SubsetsContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.references`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitReferences?: (ctx: ReferencesContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.crosses`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCrosses?: (ctx: CrossesContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.redefinitions`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRedefinitions?: (ctx: RedefinitionsContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.redefines`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRedefines?: (ctx: RedefinesContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.featureTyping`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeatureTyping?: (ctx: FeatureTypingContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedFeatureTyping`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedFeatureTyping?: (ctx: OwnedFeatureTypingContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.subsetting`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSubsetting?: (ctx: SubsettingContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedSubsetting`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedSubsetting?: (ctx: OwnedSubsettingContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedReferenceSubsetting`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedReferenceSubsetting?: (ctx: OwnedReferenceSubsettingContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedCrossSubsetting`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedCrossSubsetting?: (ctx: OwnedCrossSubsettingContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.redefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRedefinition?: (ctx: RedefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedRedefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedRedefinition?: (ctx: OwnedRedefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.featureInverting`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeatureInverting?: (ctx: FeatureInvertingContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedFeatureInverting`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedFeatureInverting?: (ctx: OwnedFeatureInvertingContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.typeFeaturing`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeFeaturing?: (ctx: TypeFeaturingContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedTypeFeaturing`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedTypeFeaturing?: (ctx: OwnedTypeFeaturingContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.dataType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDataType?: (ctx: DataTypeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.class`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClass?: (ctx: ClassContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.structure`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStructure?: (ctx: StructureContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.association`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssociation?: (ctx: AssociationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.associationStructure`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssociationStructure?: (ctx: AssociationStructureContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.connector`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConnector?: (ctx: ConnectorContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.connectorDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConnectorDeclaration?: (ctx: ConnectorDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.binaryConnectorDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBinaryConnectorDeclaration?: (ctx: BinaryConnectorDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.naryConnectorDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNaryConnectorDeclaration?: (ctx: NaryConnectorDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.connectorEndMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConnectorEndMember?: (ctx: ConnectorEndMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.connectorEnd`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConnectorEnd?: (ctx: ConnectorEndContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedCrossMultiplicityMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedCrossMultiplicityMember?: (ctx: OwnedCrossMultiplicityMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedCrossMultiplicity`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedCrossMultiplicity?: (ctx: OwnedCrossMultiplicityContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.bindingConnector`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBindingConnector?: (ctx: BindingConnectorContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.bindingConnectorDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBindingConnectorDeclaration?: (ctx: BindingConnectorDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.succession`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSuccession?: (ctx: SuccessionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.successionDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSuccessionDeclaration?: (ctx: SuccessionDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.behavior`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBehavior?: (ctx: BehaviorContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.step`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStep?: (ctx: StepContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.function`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunction?: (ctx: FunctionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.functionBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionBody?: (ctx: FunctionBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.functionBodyPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionBodyPart?: (ctx: FunctionBodyPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.returnFeatureMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitReturnFeatureMember?: (ctx: ReturnFeatureMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.resultExpressionMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitResultExpressionMember?: (ctx: ResultExpressionMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.expression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExpression?: (ctx: ExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.predicate`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPredicate?: (ctx: PredicateContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.booleanExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBooleanExpression?: (ctx: BooleanExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.invariant`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInvariant?: (ctx: InvariantContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.featureChainMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeatureChainMember?: (ctx: FeatureChainMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.interaction`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInteraction?: (ctx: InteractionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.flow`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFlow?: (ctx: FlowContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.successionFlow`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSuccessionFlow?: (ctx: SuccessionFlowContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.flowDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFlowDeclaration?: (ctx: FlowDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.payloadFeatureMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPayloadFeatureMember?: (ctx: PayloadFeatureMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.payloadFeature`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPayloadFeature?: (ctx: PayloadFeatureContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.payloadFeatureSpecializationPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPayloadFeatureSpecializationPart?: (ctx: PayloadFeatureSpecializationPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.flowEndMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFlowEndMember?: (ctx: FlowEndMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.flowEnd`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFlowEnd?: (ctx: FlowEndContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.valuePart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitValuePart?: (ctx: ValuePartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.featureValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeatureValue?: (ctx: FeatureValueContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.multiplicity`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMultiplicity?: (ctx: MultiplicityContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.multiplicitySubset`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMultiplicitySubset?: (ctx: MultiplicitySubsetContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.multiplicityRange`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMultiplicityRange?: (ctx: MultiplicityRangeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedMultiplicity`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedMultiplicity?: (ctx: OwnedMultiplicityContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ownedMultiplicityRange`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOwnedMultiplicityRange?: (ctx: OwnedMultiplicityRangeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.multiplicityBounds`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMultiplicityBounds?: (ctx: MultiplicityBoundsContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.multiplicityExpressionMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMultiplicityExpressionMember?: (ctx: MultiplicityExpressionMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.metaclass`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMetaclass?: (ctx: MetaclassContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.prefixMetadataAnnotation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrefixMetadataAnnotation?: (ctx: PrefixMetadataAnnotationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.prefixMetadataMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrefixMetadataMember?: (ctx: PrefixMetadataMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.prefixMetadataFeature`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrefixMetadataFeature?: (ctx: PrefixMetadataFeatureContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.metadataFeature`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMetadataFeature?: (ctx: MetadataFeatureContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.metadataFeatureDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMetadataFeatureDeclaration?: (ctx: MetadataFeatureDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.metadataBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMetadataBody?: (ctx: MetadataBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.metadataBodyElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMetadataBodyElement?: (ctx: MetadataBodyElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.metadataBodyFeatureMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMetadataBodyFeatureMember?: (ctx: MetadataBodyFeatureMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.metadataBodyFeature`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMetadataBodyFeature?: (ctx: MetadataBodyFeatureContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.package`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPackage?: (ctx: PackageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.libraryPackage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLibraryPackage?: (ctx: LibraryPackageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.packageDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPackageDeclaration?: (ctx: PackageDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.packageBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPackageBody?: (ctx: PackageBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.elementFilterMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitElementFilterMember?: (ctx: ElementFilterMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.dependencyDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDependencyDeclaration?: (ctx: DependencyDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.annotatingMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAnnotatingMember?: (ctx: AnnotatingMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.packageBodyElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPackageBodyElement?: (ctx: PackageBodyElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.packageMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPackageMember?: (ctx: PackageMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.definitionElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefinitionElement?: (ctx: DefinitionElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.usageElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUsageElement?: (ctx: UsageElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.basicDefinitionPrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBasicDefinitionPrefix?: (ctx: BasicDefinitionPrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.definitionExtensionKeyword`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefinitionExtensionKeyword?: (ctx: DefinitionExtensionKeywordContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.definitionPrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefinitionPrefix?: (ctx: DefinitionPrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.definition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefinition?: (ctx: DefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.definitionDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefinitionDeclaration?: (ctx: DefinitionDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.definitionBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefinitionBody?: (ctx: DefinitionBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.definitionBodyItem`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefinitionBodyItem?: (ctx: DefinitionBodyItemContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.definitionBodyItemContent`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefinitionBodyItemContent?: (ctx: DefinitionBodyItemContentContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.definitionMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefinitionMember?: (ctx: DefinitionMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.variantUsageMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVariantUsageMember?: (ctx: VariantUsageMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.nonOccurrenceUsageMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNonOccurrenceUsageMember?: (ctx: NonOccurrenceUsageMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.structureUsageMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStructureUsageMember?: (ctx: StructureUsageMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.behaviorUsageMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBehaviorUsageMember?: (ctx: BehaviorUsageMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.refPrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRefPrefix?: (ctx: RefPrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.basicUsagePrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBasicUsagePrefix?: (ctx: BasicUsagePrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.endUsagePrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEndUsagePrefix?: (ctx: EndUsagePrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.usageExtensionKeyword`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUsageExtensionKeyword?: (ctx: UsageExtensionKeywordContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.unextendedUsagePrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUnextendedUsagePrefix?: (ctx: UnextendedUsagePrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.usagePrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUsagePrefix?: (ctx: UsagePrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.usage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUsage?: (ctx: UsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.usageDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUsageDeclaration?: (ctx: UsageDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.usageCompletion`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUsageCompletion?: (ctx: UsageCompletionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.usageBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUsageBody?: (ctx: UsageBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.defaultReferenceUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefaultReferenceUsage?: (ctx: DefaultReferenceUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.referenceUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitReferenceUsage?: (ctx: ReferenceUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.endFeatureUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEndFeatureUsage?: (ctx: EndFeatureUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.variantReference`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVariantReference?: (ctx: VariantReferenceContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.nonOccurrenceUsageElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNonOccurrenceUsageElement?: (ctx: NonOccurrenceUsageElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.endOccurrenceUsageElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEndOccurrenceUsageElement?: (ctx: EndOccurrenceUsageElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.occurrenceUsageElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOccurrenceUsageElement?: (ctx: OccurrenceUsageElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.structureUsageElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStructureUsageElement?: (ctx: StructureUsageElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.behaviorUsageElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBehaviorUsageElement?: (ctx: BehaviorUsageElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.variantUsageElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVariantUsageElement?: (ctx: VariantUsageElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.subclassificationPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSubclassificationPart?: (ctx: SubclassificationPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.attributeDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAttributeDefinition?: (ctx: AttributeDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.attributeUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAttributeUsage?: (ctx: AttributeUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.enumerationDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumerationDefinition?: (ctx: EnumerationDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.enumerationBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumerationBody?: (ctx: EnumerationBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.enumerationUsageMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumerationUsageMember?: (ctx: EnumerationUsageMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.enumeratedValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumeratedValue?: (ctx: EnumeratedValueContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.enumerationUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumerationUsage?: (ctx: EnumerationUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.occurrenceDefinitionPrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOccurrenceDefinitionPrefix?: (ctx: OccurrenceDefinitionPrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.occurrenceDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOccurrenceDefinition?: (ctx: OccurrenceDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.individualDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIndividualDefinition?: (ctx: IndividualDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.emptyMultiplicityMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEmptyMultiplicityMember?: (ctx: EmptyMultiplicityMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.occurrenceUsagePrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOccurrenceUsagePrefix?: (ctx: OccurrenceUsagePrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.occurrenceUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOccurrenceUsage?: (ctx: OccurrenceUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.individualUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIndividualUsage?: (ctx: IndividualUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.portionUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPortionUsage?: (ctx: PortionUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.portionKind`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPortionKind?: (ctx: PortionKindContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.eventOccurrenceUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEventOccurrenceUsage?: (ctx: EventOccurrenceUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.sourceSuccessionMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSourceSuccessionMember?: (ctx: SourceSuccessionMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.sourceSuccession`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSourceSuccession?: (ctx: SourceSuccessionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.sourceEndMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSourceEndMember?: (ctx: SourceEndMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.sourceEnd`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSourceEnd?: (ctx: SourceEndContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.itemDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitItemDefinition?: (ctx: ItemDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.itemUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitItemUsage?: (ctx: ItemUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.partDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPartDefinition?: (ctx: PartDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.partUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPartUsage?: (ctx: PartUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.portDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPortDefinition?: (ctx: PortDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.conjugatedPortDefinitionMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConjugatedPortDefinitionMember?: (ctx: ConjugatedPortDefinitionMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.conjugatedPortDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConjugatedPortDefinition?: (ctx: ConjugatedPortDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.portUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPortUsage?: (ctx: PortUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.conjugatedPortTyping`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConjugatedPortTyping?: (ctx: ConjugatedPortTypingContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.connectionDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConnectionDefinition?: (ctx: ConnectionDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.connectionUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConnectionUsage?: (ctx: ConnectionUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.connectorPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConnectorPart?: (ctx: ConnectorPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.binaryConnectorPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBinaryConnectorPart?: (ctx: BinaryConnectorPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.naryConnectorPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNaryConnectorPart?: (ctx: NaryConnectorPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.bindingConnectorAsUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBindingConnectorAsUsage?: (ctx: BindingConnectorAsUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.successionAsUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSuccessionAsUsage?: (ctx: SuccessionAsUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.interfaceDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInterfaceDefinition?: (ctx: InterfaceDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.interfaceBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInterfaceBody?: (ctx: InterfaceBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.interfaceBodyItem`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInterfaceBodyItem?: (ctx: InterfaceBodyItemContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.interfaceNonOccurrenceUsageMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInterfaceNonOccurrenceUsageMember?: (ctx: InterfaceNonOccurrenceUsageMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.interfaceNonOccurrenceUsageElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInterfaceNonOccurrenceUsageElement?: (ctx: InterfaceNonOccurrenceUsageElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.interfaceOccurrenceUsageMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInterfaceOccurrenceUsageMember?: (ctx: InterfaceOccurrenceUsageMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.interfaceOccurrenceUsageElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInterfaceOccurrenceUsageElement?: (ctx: InterfaceOccurrenceUsageElementContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.defaultInterfaceEnd`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefaultInterfaceEnd?: (ctx: DefaultInterfaceEndContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.interfaceUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInterfaceUsage?: (ctx: InterfaceUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.interfaceUsageDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInterfaceUsageDeclaration?: (ctx: InterfaceUsageDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.interfacePart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInterfacePart?: (ctx: InterfacePartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.binaryInterfacePart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBinaryInterfacePart?: (ctx: BinaryInterfacePartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.naryInterfacePart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNaryInterfacePart?: (ctx: NaryInterfacePartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.interfaceEndMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInterfaceEndMember?: (ctx: InterfaceEndMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.interfaceEnd`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInterfaceEnd?: (ctx: InterfaceEndContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.allocationDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAllocationDefinition?: (ctx: AllocationDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.allocationUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAllocationUsage?: (ctx: AllocationUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.allocationUsageDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAllocationUsageDeclaration?: (ctx: AllocationUsageDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.flowDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFlowDefinition?: (ctx: FlowDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.message`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMessage?: (ctx: MessageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.messageDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMessageDeclaration?: (ctx: MessageDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.messageEventMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMessageEventMember?: (ctx: MessageEventMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.messageEvent`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMessageEvent?: (ctx: MessageEventContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.flowUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFlowUsage?: (ctx: FlowUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.successionFlowUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSuccessionFlowUsage?: (ctx: SuccessionFlowUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.flowPayloadFeatureMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFlowPayloadFeatureMember?: (ctx: FlowPayloadFeatureMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.flowPayloadFeature`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFlowPayloadFeature?: (ctx: FlowPayloadFeatureContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actionDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActionDefinition?: (ctx: ActionDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actionBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActionBody?: (ctx: ActionBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actionBodyItem`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActionBodyItem?: (ctx: ActionBodyItemContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.nonBehaviorBodyItem`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNonBehaviorBodyItem?: (ctx: NonBehaviorBodyItemContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actionBehaviorMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActionBehaviorMember?: (ctx: ActionBehaviorMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.initialNodeMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInitialNodeMember?: (ctx: InitialNodeMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actionNodeMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActionNodeMember?: (ctx: ActionNodeMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actionTargetSuccessionMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActionTargetSuccessionMember?: (ctx: ActionTargetSuccessionMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.guardedSuccessionMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitGuardedSuccessionMember?: (ctx: GuardedSuccessionMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actionUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActionUsage?: (ctx: ActionUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actionUsageDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActionUsageDeclaration?: (ctx: ActionUsageDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.performActionUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPerformActionUsage?: (ctx: PerformActionUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.performActionUsageDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPerformActionUsageDeclaration?: (ctx: PerformActionUsageDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actionNode`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActionNode?: (ctx: ActionNodeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actionNodeUsageDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActionNodeUsageDeclaration?: (ctx: ActionNodeUsageDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actionNodePrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActionNodePrefix?: (ctx: ActionNodePrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.controlNode`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitControlNode?: (ctx: ControlNodeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.controlNodePrefix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitControlNodePrefix?: (ctx: ControlNodePrefixContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.mergeNode`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMergeNode?: (ctx: MergeNodeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.decisionNode`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDecisionNode?: (ctx: DecisionNodeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.joinNode`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitJoinNode?: (ctx: JoinNodeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.forkNode`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForkNode?: (ctx: ForkNodeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.acceptNode`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAcceptNode?: (ctx: AcceptNodeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.acceptNodeDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAcceptNodeDeclaration?: (ctx: AcceptNodeDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.acceptParameterPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAcceptParameterPart?: (ctx: AcceptParameterPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.payloadParameterMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPayloadParameterMember?: (ctx: PayloadParameterMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.payloadParameter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPayloadParameter?: (ctx: PayloadParameterContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.triggerValuePart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTriggerValuePart?: (ctx: TriggerValuePartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.triggerFeatureValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTriggerFeatureValue?: (ctx: TriggerFeatureValueContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.triggerExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTriggerExpression?: (ctx: TriggerExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.sendNode`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSendNode?: (ctx: SendNodeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.sendNodeDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSendNodeDeclaration?: (ctx: SendNodeDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.senderReceiverPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSenderReceiverPart?: (ctx: SenderReceiverPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.nodeParameterMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNodeParameterMember?: (ctx: NodeParameterMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.nodeParameter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNodeParameter?: (ctx: NodeParameterContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.featureBinding`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFeatureBinding?: (ctx: FeatureBindingContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.emptyParameterMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEmptyParameterMember?: (ctx: EmptyParameterMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.assignmentNode`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssignmentNode?: (ctx: AssignmentNodeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.assignmentNodeDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssignmentNodeDeclaration?: (ctx: AssignmentNodeDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.assignmentTargetMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssignmentTargetMember?: (ctx: AssignmentTargetMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.assignmentTargetParameter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssignmentTargetParameter?: (ctx: AssignmentTargetParameterContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.assignmentTargetBinding`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssignmentTargetBinding?: (ctx: AssignmentTargetBindingContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.terminateNode`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTerminateNode?: (ctx: TerminateNodeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ifNode`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIfNode?: (ctx: IfNodeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.expressionParameterMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExpressionParameterMember?: (ctx: ExpressionParameterMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actionBodyParameterMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActionBodyParameterMember?: (ctx: ActionBodyParameterMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actionBodyParameter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActionBodyParameter?: (ctx: ActionBodyParameterContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.ifNodeParameterMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIfNodeParameterMember?: (ctx: IfNodeParameterMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.whileLoopNode`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitWhileLoopNode?: (ctx: WhileLoopNodeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.forLoopNode`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForLoopNode?: (ctx: ForLoopNodeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.forVariableDeclarationMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForVariableDeclarationMember?: (ctx: ForVariableDeclarationMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actionTargetSuccession`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActionTargetSuccession?: (ctx: ActionTargetSuccessionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.targetSuccession`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTargetSuccession?: (ctx: TargetSuccessionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.guardedTargetSuccession`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitGuardedTargetSuccession?: (ctx: GuardedTargetSuccessionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.defaultTargetSuccession`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefaultTargetSuccession?: (ctx: DefaultTargetSuccessionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.guardedSuccession`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitGuardedSuccession?: (ctx: GuardedSuccessionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.stateDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStateDefinition?: (ctx: StateDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.stateDefBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStateDefBody?: (ctx: StateDefBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.stateBodyItem`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStateBodyItem?: (ctx: StateBodyItemContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.entryActionMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEntryActionMember?: (ctx: EntryActionMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.doActionMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDoActionMember?: (ctx: DoActionMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.exitActionMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExitActionMember?: (ctx: ExitActionMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.entryTransitionMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEntryTransitionMember?: (ctx: EntryTransitionMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.stateActionUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStateActionUsage?: (ctx: StateActionUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.statePerformActionUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStatePerformActionUsage?: (ctx: StatePerformActionUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.stateAcceptActionUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStateAcceptActionUsage?: (ctx: StateAcceptActionUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.stateSendActionUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStateSendActionUsage?: (ctx: StateSendActionUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.stateAssignmentActionUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStateAssignmentActionUsage?: (ctx: StateAssignmentActionUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.transitionUsageMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTransitionUsageMember?: (ctx: TransitionUsageMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.targetTransitionUsageMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTargetTransitionUsageMember?: (ctx: TargetTransitionUsageMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.stateUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStateUsage?: (ctx: StateUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.stateUsageBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStateUsageBody?: (ctx: StateUsageBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.exhibitStateUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExhibitStateUsage?: (ctx: ExhibitStateUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.transitionUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTransitionUsage?: (ctx: TransitionUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.targetTransitionUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTargetTransitionUsage?: (ctx: TargetTransitionUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.triggerActionMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTriggerActionMember?: (ctx: TriggerActionMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.triggerAction`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTriggerAction?: (ctx: TriggerActionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.guardExpressionMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitGuardExpressionMember?: (ctx: GuardExpressionMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.effectBehaviorMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEffectBehaviorMember?: (ctx: EffectBehaviorMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.effectBehaviorUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEffectBehaviorUsage?: (ctx: EffectBehaviorUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.transitionPerformActionUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTransitionPerformActionUsage?: (ctx: TransitionPerformActionUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.transitionAcceptActionUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTransitionAcceptActionUsage?: (ctx: TransitionAcceptActionUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.transitionSendActionUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTransitionSendActionUsage?: (ctx: TransitionSendActionUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.transitionAssignmentActionUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTransitionAssignmentActionUsage?: (ctx: TransitionAssignmentActionUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.transitionSuccessionMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTransitionSuccessionMember?: (ctx: TransitionSuccessionMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.transitionSuccession`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTransitionSuccession?: (ctx: TransitionSuccessionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.emptyEndMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEmptyEndMember?: (ctx: EmptyEndMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.calculationDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCalculationDefinition?: (ctx: CalculationDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.calculationUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCalculationUsage?: (ctx: CalculationUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.calculationBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCalculationBody?: (ctx: CalculationBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.calculationBodyPart`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCalculationBodyPart?: (ctx: CalculationBodyPartContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.calculationBodyItem`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCalculationBodyItem?: (ctx: CalculationBodyItemContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.returnParameterMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitReturnParameterMember?: (ctx: ReturnParameterMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.constraintDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConstraintDefinition?: (ctx: ConstraintDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.constraintUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConstraintUsage?: (ctx: ConstraintUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.assertConstraintUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssertConstraintUsage?: (ctx: AssertConstraintUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.constraintUsageDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConstraintUsageDeclaration?: (ctx: ConstraintUsageDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.requirementDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRequirementDefinition?: (ctx: RequirementDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.requirementBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRequirementBody?: (ctx: RequirementBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.requirementBodyItem`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRequirementBodyItem?: (ctx: RequirementBodyItemContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.subjectMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSubjectMember?: (ctx: SubjectMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.subjectUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSubjectUsage?: (ctx: SubjectUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.requirementConstraintMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRequirementConstraintMember?: (ctx: RequirementConstraintMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.requirementKind`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRequirementKind?: (ctx: RequirementKindContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.requirementConstraintUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRequirementConstraintUsage?: (ctx: RequirementConstraintUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.framedConcernMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFramedConcernMember?: (ctx: FramedConcernMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.framedConcernUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFramedConcernUsage?: (ctx: FramedConcernUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actorMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActorMember?: (ctx: ActorMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.actorUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitActorUsage?: (ctx: ActorUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.stakeholderMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStakeholderMember?: (ctx: StakeholderMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.stakeholderUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStakeholderUsage?: (ctx: StakeholderUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.requirementUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRequirementUsage?: (ctx: RequirementUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.satisfyRequirementUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSatisfyRequirementUsage?: (ctx: SatisfyRequirementUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.satisfactionSubjectMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSatisfactionSubjectMember?: (ctx: SatisfactionSubjectMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.satisfactionParameter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSatisfactionParameter?: (ctx: SatisfactionParameterContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.satisfactionFeatureValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSatisfactionFeatureValue?: (ctx: SatisfactionFeatureValueContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.satisfactionReferenceExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSatisfactionReferenceExpression?: (ctx: SatisfactionReferenceExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.concernDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConcernDefinition?: (ctx: ConcernDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.concernUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConcernUsage?: (ctx: ConcernUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.caseDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCaseDefinition?: (ctx: CaseDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.caseUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCaseUsage?: (ctx: CaseUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.caseBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCaseBody?: (ctx: CaseBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.caseBodyItem`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCaseBodyItem?: (ctx: CaseBodyItemContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.objectiveMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitObjectiveMember?: (ctx: ObjectiveMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.objectiveRequirementUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitObjectiveRequirementUsage?: (ctx: ObjectiveRequirementUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.analysisCaseDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAnalysisCaseDefinition?: (ctx: AnalysisCaseDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.analysisCaseUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAnalysisCaseUsage?: (ctx: AnalysisCaseUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.verificationCaseDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVerificationCaseDefinition?: (ctx: VerificationCaseDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.verificationCaseUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVerificationCaseUsage?: (ctx: VerificationCaseUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.requirementVerificationMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRequirementVerificationMember?: (ctx: RequirementVerificationMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.requirementVerificationUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRequirementVerificationUsage?: (ctx: RequirementVerificationUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.useCaseDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUseCaseDefinition?: (ctx: UseCaseDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.useCaseUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUseCaseUsage?: (ctx: UseCaseUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.includeUseCaseUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIncludeUseCaseUsage?: (ctx: IncludeUseCaseUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.viewDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitViewDefinition?: (ctx: ViewDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.viewDefinitionBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitViewDefinitionBody?: (ctx: ViewDefinitionBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.viewDefinitionBodyItem`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitViewDefinitionBodyItem?: (ctx: ViewDefinitionBodyItemContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.viewRenderingMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitViewRenderingMember?: (ctx: ViewRenderingMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.viewRenderingUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitViewRenderingUsage?: (ctx: ViewRenderingUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.viewUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitViewUsage?: (ctx: ViewUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.viewBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitViewBody?: (ctx: ViewBodyContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.viewBodyItem`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitViewBodyItem?: (ctx: ViewBodyItemContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.expose`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExpose?: (ctx: ExposeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.membershipExpose`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMembershipExpose?: (ctx: MembershipExposeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.namespaceExpose`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamespaceExpose?: (ctx: NamespaceExposeContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.viewpointDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitViewpointDefinition?: (ctx: ViewpointDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.viewpointUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitViewpointUsage?: (ctx: ViewpointUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.renderingDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRenderingDefinition?: (ctx: RenderingDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.renderingUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRenderingUsage?: (ctx: RenderingUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.metadataDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMetadataDefinition?: (ctx: MetadataDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.prefixMetadataUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrefixMetadataUsage?: (ctx: PrefixMetadataUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.metadataBodyUsageMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMetadataBodyUsageMember?: (ctx: MetadataBodyUsageMemberContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.metadataBodyUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMetadataBodyUsage?: (ctx: MetadataBodyUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.extendedDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExtendedDefinition?: (ctx: ExtendedDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.extendedUsage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExtendedUsage?: (ctx: ExtendedUsageContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.filterPackageImportDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFilterPackageImportDeclaration?: (ctx: FilterPackageImportDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.namespaceImportDirect`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamespaceImportDirect?: (ctx: NamespaceImportDirectContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.calculationUsageDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCalculationUsageDeclaration?: (ctx: CalculationUsageDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.emptyActionUsage_`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEmptyActionUsage_?: (ctx: EmptyActionUsage_Context) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.emptyFeature_`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEmptyFeature_?: (ctx: EmptyFeature_Context) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.emptyMultiplicity_`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEmptyMultiplicity_?: (ctx: EmptyMultiplicity_Context) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.emptyUsage_`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEmptyUsage_?: (ctx: EmptyUsage_Context) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.filterPackageImport`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFilterPackageImport?: (ctx: FilterPackageImportContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.nonFeatureChainPrimaryExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNonFeatureChainPrimaryExpression?: (ctx: NonFeatureChainPrimaryExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `SysMLv2Parser.portConjugation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPortConjugation?: (ctx: PortConjugationContext) => Result;
}

